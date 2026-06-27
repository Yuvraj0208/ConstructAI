"""AI agent that drafts purchase orders for the manager to approve.

To stay grounded, it never invents vendors or prices: it builds the real
candidate offers for each low/critical material, then (with a key) asks Claude to
*select* offers + quantities within the remaining budget. The picks are validated
against the real offers and saved as SUGGESTED purchase orders. With no key it
falls back to the deterministic auto-procurement engine.
"""
from __future__ import annotations

import json

from sqlalchemy import select
from sqlalchemy.orm import Session

from ...config import settings
from ...models import Budget, POStatus, PurchaseOrder, Site, VendorOffer
from ..procurement import compute_urgency, generate_suggestions, score_offers
from . import context
from .budget import build_forecast
from .client import get_client

_DRAFT_SCHEMA = {
    "type": "object",
    "properties": {
        "orders": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "material_id": {"type": "integer"},
                    "offer_id": {"type": "integer"},
                    "quantity": {"type": "number"},
                    "reason": {"type": "string"},
                },
                "required": ["material_id", "offer_id", "quantity", "reason"],
                "additionalProperties": False,
            },
        }
    },
    "required": ["orders"],
    "additionalProperties": False,
}


def _candidates(db: Session, site: Site) -> tuple[list[dict], dict[int, VendorOffer]]:
    materials = [m for m in context.site_materials(db, site) if m.status in ("low", "critical")]
    cands: list[dict] = []
    offer_map: dict[int, VendorOffer] = {}
    for m in materials:
        offers = [
            o
            for o in db.scalars(
                select(VendorOffer).where(
                    VendorOffer.material_id == m.id, VendorOffer.is_active.is_(True)
                )
            ).all()
            if o.available_quantity > 0
        ]
        if not offers:
            continue
        ranked = score_offers(offers, compute_urgency(m.available_stock, m.threshold))
        opts = []
        for s in ranked[:4]:
            offer_map[s.offer.id] = s.offer
            opts.append(
                {
                    "offer_id": s.offer.id,
                    "vendor": s.offer.vendor.name if s.offer.vendor else "vendor",
                    "price_per_unit": round(s.offer.price_per_unit, 2),
                    "eta_days": s.offer.eta_days,
                    "available": round(s.offer.available_quantity, 2),
                }
            )
        cands.append(
            {
                "material_id": m.id,
                "material": m.name,
                "unit": m.unit,
                "status": m.status,
                "available": round(m.available_stock, 2),
                "threshold": round(m.threshold, 2),
                "suggested_quantity": round(max(0.0, m.target_stock - m.current_stock), 2),
                "weather_sensitive": m.weather_sensitive,
                "offers": opts,
            }
        )
    return cands, offer_map


def _clear_stale(db: Session, material_ids: list[int]) -> None:
    if not material_ids:
        return
    for po in db.scalars(
        select(PurchaseOrder).where(
            PurchaseOrder.material_id.in_(material_ids),
            PurchaseOrder.status == POStatus.SUGGESTED,
        )
    ).all():
        db.delete(po)


def draft_orders(db: Session, site: Site) -> list[PurchaseOrder]:
    """Draft SUGGESTED purchase orders. Claude when configured, else the engine."""
    client = get_client()
    if client is None:
        created, _weather, _advisory = generate_suggestions(db, site)
        return created
    try:
        return _claude_draft(client, db, site)
    except Exception:
        created, _weather, _advisory = generate_suggestions(db, site)
        return created


def _claude_draft(client, db: Session, site: Site) -> list[PurchaseOrder]:
    cands, offer_map = _candidates(db, site)
    if not cands:
        return []

    budget = db.scalar(select(Budget).where(Budget.site_id == site.id))
    remaining = "unknown"
    if budget:
        f = build_forecast(db, site, budget)
        remaining = round(budget.total_amount - (f["spend"]["total"] + f["committed"]), 2)
    weather = context.weather(site)

    prompt = (
        "You are a procurement officer drafting purchase orders for a site manager to "
        "approve. For each material below, choose the best vendor offer and a sensible "
        "quantity (around suggested_quantity, adjusted for urgency, recent usage and "
        "weather). You may skip a material. Pick ONLY from the given offer_ids — never "
        "invent vendors or prices. Stay within the remaining budget where reasonable; if a "
        "critical material would exceed it, still order what's needed and say so.\n\n"
        f"Remaining budget (INR): {remaining}\n"
        f"Weather: {'rain expected' if weather.get('will_rain') else 'clear'}\n"
        f"Materials & offers:\n{json.dumps(cands, default=str)}\n"
        f"Recent usage:\n{json.dumps(context.usage_trends(db, site), default=str)}\n\n"
        "Return an `orders` array of {material_id, offer_id, quantity, reason}."
    )
    response = client.messages.create(
        model=settings.ai_model,
        max_tokens=1500,
        messages=[{"role": "user", "content": prompt}],
        output_config={"format": {"type": "json_schema", "schema": _DRAFT_SCHEMA}},
    )
    text = next((b.text for b in response.content if b.type == "text"), "")
    picks = json.loads(text).get("orders", [])

    _clear_stale(db, [c["material_id"] for c in cands])
    created: list[PurchaseOrder] = []
    for p in picks:
        offer = offer_map.get(int(p.get("offer_id", -1)))
        if offer is None or offer.material_id != int(p.get("material_id", -1)):
            continue
        qty = round(min(float(p.get("quantity", 0) or 0), offer.available_quantity), 2)
        if qty <= 0:
            continue
        po = PurchaseOrder(
            material_id=offer.material_id,
            vendor_id=offer.vendor_id,
            offer_id=offer.id,
            quantity=qty,
            price_per_unit=offer.price_per_unit,
            total_price=round(qty * offer.price_per_unit, 2),
            eta_days=offer.eta_days,
            status=POStatus.SUGGESTED,
            rationale="AI · " + str(p.get("reason", ""))[:400],
        )
        db.add(po)
        created.append(po)

    db.commit()
    for po in created:
        db.refresh(po)
    return created
