"""Read-only context builders over the live DB — the 'retrieval' half of the
contextual-RAG design. These ground every AI answer in real site data and are
shared by both the Claude tool-calling agent and the rule-based fallback, so the
two can never drift apart.

Every function returns plain JSON-serialisable structures.
"""
from __future__ import annotations

import statistics
from collections import defaultdict
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from ...models import (
    DailyUpdate,
    Material,
    Milestone,
    MovementType,
    POStatus,
    PurchaseOrder,
    Site,
    StockMovement,
    VendorOffer,
)
from ..procurement import compute_urgency, score_offers
from ..weather import get_forecast

_COMMITTED = (POStatus.APPROVED, POStatus.ORDERED)


def _round(n: float) -> float:
    return round(float(n), 2)


def _as_utc(dt: datetime | None) -> datetime | None:
    """Coerce naive datetimes (SQLite) to UTC so date math is safe everywhere."""
    if dt is None:
        return None
    return dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt


def site_materials(db: Session, site: Site) -> list[Material]:
    return list(db.scalars(select(Material).where(Material.site_id == site.id)).all())


# --------------------------------------------------------------------------- #
# Context tools (each maps to a Claude tool of the same intent)
# --------------------------------------------------------------------------- #
def stock_health(db: Session, site: Site) -> dict:
    materials = site_materials(db, site)
    rows = []
    counts = {"ok": 0, "low": 0, "critical": 0}
    for m in materials:
        counts[m.status] = counts.get(m.status, 0) + 1
        rows.append(
            {
                "material": m.name,
                "unit": m.unit,
                "on_hand": _round(m.current_stock),
                "available": _round(m.available_stock),
                "reserved": _round(m.reserved_quantity),
                "threshold": _round(m.threshold),
                "target": _round(m.target_stock),
                "status": m.status,
                "weather_sensitive": m.weather_sensitive,
            }
        )
    return {"site": site.name, "city": site.city, "counts": counts, "materials": rows}


def usage_trends(db: Session, site: Site, days: int = 14) -> dict:
    """Per-material daily consumption with spike detection (mean + 2·std)."""
    materials = {m.id: m for m in site_materials(db, site)}
    if not materials:
        return {"materials": []}

    movements = db.scalars(
        select(StockMovement)
        .where(
            StockMovement.material_id.in_(list(materials)),
            StockMovement.movement_type == MovementType.CONSUMPTION,
        )
        .order_by(StockMovement.created_at.desc())
    ).all()

    cutoff = datetime.now(timezone.utc).date()
    by_material: dict[int, dict[str, float]] = defaultdict(lambda: defaultdict(float))
    for mv in movements:
        created = _as_utc(mv.created_at)
        if created is None:
            continue
        day = created.date()
        if (cutoff - day).days >= days:
            continue
        by_material[mv.material_id][day.isoformat()] += abs(mv.quantity)

    out = []
    for mid, daily in by_material.items():
        mat = materials[mid]
        values = list(daily.values())
        if not values:
            continue
        mean = statistics.mean(values)
        std = statistics.pstdev(values) if len(values) > 1 else 0.0
        alert = mean + 2 * std
        spikes = sorted(
            ({"date": d, "amount": _round(v)} for d, v in daily.items() if std > 0 and v > alert),
            key=lambda x: x["amount"],
            reverse=True,
        )
        out.append(
            {
                "material": mat.name,
                "unit": mat.unit,
                "total_consumed": _round(sum(values)),
                "avg_daily": _round(mean),
                "peak_day": _round(max(values)),
                "spikes": spikes,
            }
        )
    out.sort(key=lambda x: x["total_consumed"], reverse=True)
    return {"window_days": days, "materials": out}


def vendor_options(db: Session, site: Site) -> dict:
    """For each low/critical material, the best-ranked vendor offers."""
    materials = [m for m in site_materials(db, site) if m.status in ("low", "critical")]
    out = []
    for m in materials:
        offers = list(
            db.scalars(
                select(VendorOffer).where(
                    VendorOffer.material_id == m.id, VendorOffer.is_active.is_(True)
                )
            ).all()
        )
        active = [o for o in offers if o.available_quantity > 0]
        if not active:
            continue
        urgency = compute_urgency(m.available_stock, m.threshold)
        ranked = score_offers(active, urgency)[:3]
        out.append(
            {
                "material": m.name,
                "unit": m.unit,
                "status": m.status,
                "shortfall": _round(max(0.0, m.target_stock - m.current_stock)),
                "offers": [
                    {
                        "vendor": s.offer.vendor.name if s.offer.vendor else "vendor",
                        "price_per_unit": _round(s.offer.price_per_unit),
                        "eta_days": s.offer.eta_days,
                        "available": _round(s.offer.available_quantity),
                        "rank_score": _round(s.score),
                    }
                    for s in ranked
                ],
            }
        )
    return {"materials": out}


def weather(site: Site) -> dict:
    f = get_forecast(site.city or "Mumbai")
    return {
        "city": f.get("city"),
        "condition": f.get("condition"),
        "temp_c": f.get("temp_c"),
        "will_rain": bool(f.get("will_rain")),
        "days": f.get("days", []),
    }


def site_progress(db: Session, site: Site, limit: int = 5) -> dict:
    updates = db.scalars(
        select(DailyUpdate)
        .where(DailyUpdate.site_id == site.id)
        .order_by(DailyUpdate.created_at.desc())
        .limit(limit)
    ).all()
    if not updates:
        return {"latest_progress": None, "avg_labor": 0, "updates": [], "open_issues": []}
    latest = updates[0]
    labor_vals = [u.labor_count for u in updates if u.labor_count]
    return {
        "latest_progress": _round(latest.progress_percent),
        "avg_labor": round(statistics.mean(labor_vals)) if labor_vals else 0,
        "open_issues": [u.issues for u in updates if u.issues][:3],
        "updates": [
            {
                "progress_percent": _round(u.progress_percent),
                "labor_count": u.labor_count,
                "summary": u.summary,
                "issues": u.issues,
                "weather_impact": u.weather_impact,
                "date": (_as_utc(u.created_at) or datetime.now(timezone.utc)).date().isoformat(),
            }
            for u in updates
        ],
    }


def open_orders(db: Session, site: Site) -> dict:
    pos = db.scalars(
        select(PurchaseOrder)
        .join(Material, PurchaseOrder.material_id == Material.id)
        .where(
            Material.site_id == site.id,
            PurchaseOrder.status.in_(
                [POStatus.SUGGESTED, POStatus.APPROVED, POStatus.ORDERED]
            ),
        )
        .order_by(PurchaseOrder.created_at.desc())
    ).all()
    return {
        "orders": [
            {
                "material": po.material.name if po.material else None,
                "vendor": po.vendor.name if po.vendor else None,
                "quantity": _round(po.quantity),
                "total_price": _round(po.total_price),
                "eta_days": po.eta_days,
                "status": po.status.value,
            }
            for po in pos
        ]
    }


def spend_summary(db: Session, site: Site, labor_rate: float) -> dict:
    """Money already committed/spent, derived from POs + labour headcount."""
    pos = db.scalars(
        select(PurchaseOrder)
        .join(Material, PurchaseOrder.material_id == Material.id)
        .where(Material.site_id == site.id)
    ).all()
    delivered = sum(po.total_price for po in pos if po.status == POStatus.DELIVERED)
    committed = sum(po.total_price for po in pos if po.status in _COMMITTED)

    updates = db.scalars(
        select(DailyUpdate).where(DailyUpdate.site_id == site.id)
    ).all()
    worker_days = sum(u.labor_count for u in updates)
    labour_spend = worker_days * labor_rate

    return {
        "material_delivered": _round(delivered),
        "material_committed": _round(committed),
        "labour_spend": _round(labour_spend),
        "worker_days": worker_days,
        "labor_rate": _round(labor_rate),
    }


def schedule(db: Session, site: Site) -> dict:
    """Project milestones with days-to-target + which are overdue/at-risk vs. progress."""
    today = datetime.now(timezone.utc).date()
    milestones = list(
        db.scalars(
            select(Milestone)
            .where(Milestone.site_id == site.id)
            .order_by(Milestone.sort_order, Milestone.target_date)
        ).all()
    )
    latest = db.scalar(
        select(DailyUpdate)
        .where(DailyUpdate.site_id == site.id)
        .order_by(DailyUpdate.created_at.desc())
    )
    rows, at_risk = [], []
    for m in milestones:
        days = (m.target_date - today).days
        done = m.status == "done"
        rows.append(
            {
                "title": m.title,
                "target_date": m.target_date.isoformat(),
                "days_remaining": days,
                "done": done,
            }
        )
        if not done and days < 0:
            at_risk.append(f"{m.title} overdue by {-days} day(s)")
        elif not done and days <= 7:
            at_risk.append(f"{m.title} due in {days} day(s)")
    return {
        "today": today.isoformat(),
        "latest_progress": _round(latest.progress_percent) if latest else None,
        "milestones": rows,
        "at_risk": at_risk,
    }


def full_context(db: Session, site: Site, labor_rate: float) -> dict:
    """Everything at once — used to brief the agent and to drive the fallback."""
    return {
        "stock_health": stock_health(db, site),
        "usage_trends": usage_trends(db, site),
        "vendor_options": vendor_options(db, site),
        "weather": weather(site),
        "site_progress": site_progress(db, site),
        "open_orders": open_orders(db, site),
        "spend_summary": spend_summary(db, site, labor_rate),
        "schedule": schedule(db, site),
    }
