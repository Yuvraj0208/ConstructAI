"""Auto-procurement engine.

When a material is at/below its reorder threshold, the engine:
  1. computes how much to order (refill toward target, + a rain buffer if needed),
  2. scores every active vendor offer on price vs. ETA vs. vendor rating, with the
     weighting shifting toward SPEED as the shortage gets more urgent,
  3. allocates the needed quantity greedily across the best offers (so when stock
     is critical it will buy some from a faster-but-pricier vendor to cover the gap).

The output is a set of SUGGESTED purchase orders for a manager to approve.
"""
from __future__ import annotations

import math
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..config import settings
from ..models import Material, POStatus, PurchaseOrder, Role, Site, User, VendorOffer
from .weather import get_forecast

RAIN_BUFFER_FACTOR = 1.20  # order 20% extra of weather-sensitive materials before rain


def _fmt(n: float) -> str:
    n = round(n, 2)
    return str(int(n)) if n == int(n) else str(n)


def compute_urgency(current: float, threshold: float) -> float:
    """0.0 when stock is at/above threshold, → 1.0 as it approaches empty."""
    if threshold <= 0:
        return 0.0
    return max(0.0, min(1.0, (threshold - current) / threshold))


def _normalize(values: list[float], lower_is_better: bool) -> list[float]:
    lo, hi = min(values), max(values)
    if hi == lo:
        return [1.0 for _ in values]
    if lower_is_better:
        return [(hi - v) / (hi - lo) for v in values]
    return [(v - lo) / (hi - lo) for v in values]


@dataclass
class ScoredOffer:
    offer: VendorOffer
    score: float
    price_score: float
    eta_score: float


def score_offers(offers: list[VendorOffer], urgency: float) -> list[ScoredOffer]:
    """Rank offers best-first. Speed is weighted higher when urgency is high."""
    prices = [o.price_per_unit for o in offers]
    etas = [float(o.eta_days) for o in offers]
    price_scores = _normalize(prices, lower_is_better=True)
    eta_scores = _normalize(etas, lower_is_better=True)

    w_price = 0.6 - 0.4 * urgency  # 0.6 (relaxed) → 0.2 (urgent)
    w_eta = 0.3 + 0.5 * urgency    # 0.3 (relaxed) → 0.8 (urgent)
    w_rating = 0.1

    scored: list[ScoredOffer] = []
    for offer, ps, es in zip(offers, price_scores, eta_scores):
        rating = offer.vendor.rating if offer.vendor else 3.0
        total = w_price * ps + w_eta * es + w_rating * (rating / 5.0)
        scored.append(ScoredOffer(offer=offer, score=total, price_score=ps, eta_score=es))

    scored.sort(key=lambda s: s.score, reverse=True)
    return scored


@dataclass
class PlannedOrder:
    offer: VendorOffer
    quantity: float
    rationale: str


def plan_material(material: Material, offers: list[VendorOffer], rain_buffer: bool) -> list[PlannedOrder]:
    active = [o for o in offers if o.is_active and o.available_quantity > 0]
    if not active:
        return []

    # Urgency & status are based on AVAILABLE stock (current minus the safety reserve).
    urgency = compute_urgency(material.available_stock, material.threshold)
    level = "Critical" if material.available_stock <= 0.5 * material.threshold else "Low"

    reserve_note = ""
    if material.reserved_quantity > 0:
        reserve_note = f"; {_fmt(material.reserved_quantity)} {material.unit} reserved"

    target = material.target_stock if material.target_stock > material.current_stock else material.threshold
    deficit = max(0.0, target - material.current_stock)
    buffer_note = ""
    if rain_buffer:
        deficit *= RAIN_BUFFER_FACTOR
        buffer_note = f" (incl. +{round((RAIN_BUFFER_FACTOR - 1) * 100)}% rain buffer)"
    deficit = math.ceil(deficit)
    if deficit <= 0:
        return []

    scored = score_offers(active, urgency)
    fastest_eta = min(o.eta_days for o in active)
    cheapest = min(o.price_per_unit for o in active)

    plans: list[PlannedOrder] = []
    remaining = float(deficit)
    for idx, s in enumerate(scored):
        if remaining <= 0:
            break
        offer = s.offer
        qty = round(min(remaining, offer.available_quantity), 2)
        if qty <= 0:
            continue

        reasons = []
        if offer.eta_days == fastest_eta:
            reasons.append("fastest delivery")
        if offer.price_per_unit == cheapest:
            reasons.append("lowest price")
        if not reasons:
            reasons.append("best price/speed balance" if idx == 0 else "covers the remaining shortfall")

        rationale = (
            f"{level}: {_fmt(material.available_stock)}/{_fmt(material.threshold)} "
            f"{material.unit} available{reserve_note}. Order ~{_fmt(deficit)} "
            f"{material.unit}{buffer_note}. Chose {offer.vendor.name if offer.vendor else 'vendor'} "
            f"— {', '.join(reasons)} (₹{_fmt(offer.price_per_unit)}/{material.unit}, {offer.eta_days}d)."
        )
        plans.append(PlannedOrder(offer=offer, quantity=qty, rationale=rationale))
        remaining -= qty

    return plans


def generate_suggestions(db: Session, site: Site) -> tuple[list[PurchaseOrder], dict, list[str]]:
    """Run the engine for all low/critical materials at a site.

    Returns (created purchase orders, weather forecast dict, advisory material names).
    Existing un-approved SUGGESTED orders for the affected materials are cleared first
    so re-running stays idempotent.
    """
    weather = get_forecast(site.city) if site.city else get_forecast("Mumbai")
    will_rain = bool(weather.get("will_rain"))

    materials = list(db.scalars(select(Material).where(Material.site_id == site.id)).all())
    low_materials = [m for m in materials if m.status in ("low", "critical")]

    material_ids = [m.id for m in low_materials]
    if material_ids:
        stale = db.scalars(
            select(PurchaseOrder).where(
                PurchaseOrder.material_id.in_(material_ids),
                PurchaseOrder.status == POStatus.SUGGESTED,
            )
        ).all()
        for po in stale:
            db.delete(po)

    created: list[PurchaseOrder] = []
    advisory: list[str] = []
    for material in low_materials:
        rain_buffer = will_rain and material.weather_sensitive
        if rain_buffer and material.name not in advisory:
            advisory.append(material.name)

        offers = list(
            db.scalars(
                select(VendorOffer).where(
                    VendorOffer.material_id == material.id, VendorOffer.is_active.is_(True)
                )
            ).all()
        )
        for plan in plan_material(material, offers, rain_buffer):
            po = PurchaseOrder(
                material_id=material.id,
                vendor_id=plan.offer.vendor_id,
                offer_id=plan.offer.id,
                quantity=plan.quantity,
                price_per_unit=plan.offer.price_per_unit,
                total_price=round(plan.quantity * plan.offer.price_per_unit, 2),
                eta_days=plan.offer.eta_days,
                status=POStatus.SUGGESTED,
                rationale=plan.rationale,
            )
            db.add(po)
            created.append(po)

    db.commit()
    for po in created:
        db.refresh(po)
    return created, weather, advisory


def _add_demo_po(db, mat, offer, qty, status, created_days, decided_days, decided_by, why, now):
    qty = round(max(1.0, qty), 1)
    db.add(
        PurchaseOrder(
            material_id=mat.id,
            vendor_id=offer.vendor_id,
            offer_id=offer.id,
            quantity=qty,
            price_per_unit=offer.price_per_unit,
            total_price=round(qty * offer.price_per_unit, 2),
            eta_days=offer.eta_days,
            status=status,
            rationale=why,
            created_at=now - timedelta(days=created_days),
            decided_at=(now - timedelta(days=decided_days)) if decided_days is not None else None,
            decided_by_id=decided_by,
        )
    )


def ensure_demo_orders(db: Session, site: Site, *, force: bool = False) -> bool:
    """Backfill a realistic procurement history for a site that has none, so the
    procurement panel and budget spend are populated without a manual re-seed:
    a delivered + an in-transit order per material, plus a pending suggestion for
    any low-stock material. Idempotent — only runs when the site has zero orders.
    Gated by settings.demo_autoseed unless forced (the seeder forces it)."""
    if not force and not settings.demo_autoseed:
        return False
    existing = db.scalar(
        select(func.count())
        .select_from(PurchaseOrder)
        .join(Material, PurchaseOrder.material_id == Material.id)
        .where(Material.site_id == site.id)
    )
    if existing:
        return False

    manager = db.scalars(select(User).where(User.role == Role.MANAGER).order_by(User.id)).first()
    manager_id = manager.id if manager else None
    now = datetime.now(timezone.utc)
    created = False
    for mat in db.scalars(select(Material).where(Material.site_id == site.id)).all():
        offers = db.scalars(select(VendorOffer).where(VendorOffer.material_id == mat.id)).all()
        if not offers:
            continue
        cheapest = min(offers, key=lambda o: o.price_per_unit)
        fastest = min(offers, key=lambda o: o.eta_days)
        target = mat.target_stock or (mat.threshold * 2) or 100.0

        _add_demo_po(db, mat, cheapest, target * 0.45, POStatus.DELIVERED, 12, 11, manager_id,
                     "Bulk restock to target — lowest landed cost.", now)
        _add_demo_po(db, mat, fastest, target * 0.30, POStatus.ORDERED, 3, 3, manager_id,
                     "Expedited top-up — fastest ETA to cover near-term usage.", now)
        if mat.current_stock < mat.threshold:
            _add_demo_po(db, mat, cheapest, target - mat.current_stock, POStatus.SUGGESTED, 0, None, None,
                         "Stock below threshold — refill to target at the best price.", now)
        created = True

    if created:
        db.commit()
    return created
