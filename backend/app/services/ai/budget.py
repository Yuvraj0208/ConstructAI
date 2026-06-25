"""AI-proposed budgeting.

`propose_budget` estimates a realistic project budget (materials + labour +
contingency) by connecting vendor prices, labour headcount, schedule progress and
weather. Claude refines the estimate when configured; otherwise a transparent
heuristic produces the same shape. `build_forecast` compares it to actual spend.
"""
from __future__ import annotations

import json

from sqlalchemy import select
from sqlalchemy.orm import Session

from ...config import settings
from ...models import Budget, PurchaseOrder, Site, VendorOffer
from . import context
from .client import ai_enabled, get_client

_TURNOVER = 3.0  # materials are bought & consumed a few times over a project
_DEFAULT_PROJECT_DAYS = 180
_NOMINAL_UNIT_COST = 200.0

_BUDGET_SCHEMA = {
    "type": "object",
    "properties": {
        "materials_amount": {"type": "number"},
        "labour_amount": {"type": "number"},
        "contingency_amount": {"type": "number"},
        "rationale": {"type": "string"},
    },
    "required": ["materials_amount", "labour_amount", "contingency_amount", "rationale"],
    "additionalProperties": False,
}


def _money(n: float) -> str:
    return "₹" + f"{round(float(n)):,}"


def _cheapest_price(db: Session, material_id: int) -> float | None:
    offers = db.scalars(
        select(VendorOffer).where(
            VendorOffer.material_id == material_id, VendorOffer.is_active.is_(True)
        )
    ).all()
    prices = [o.price_per_unit for o in offers if o.available_quantity > 0]
    return min(prices) if prices else None


def _heuristic_budget(db: Session, site: Site) -> dict:
    labor_rate = settings.labor_rate_per_worker_day
    materials = context.site_materials(db, site)

    # Materials: cost to provision the full target inventory once, × a turnover factor.
    full_stock = 0.0
    for m in materials:
        price = _cheapest_price(db, m.id)
        if price is None:
            po = db.scalars(
                select(PurchaseOrder)
                .where(PurchaseOrder.material_id == m.id)
                .order_by(PurchaseOrder.created_at.desc())
            ).first()
            price = po.price_per_unit if po else _NOMINAL_UNIT_COST
        full_stock += m.target_stock * price
    materials_amount = full_stock * _TURNOVER

    # Labour: extrapolate spend-to-date by progress, else avg headcount × default days.
    spend = context.spend_summary(db, site, labor_rate)
    progress = context.site_progress(db, site)
    prog = progress["latest_progress"] or 0
    if prog >= 5 and spend["labour_spend"] > 0:
        labour_amount = spend["labour_spend"] / (prog / 100.0)
    else:
        avg = progress["avg_labor"] or 12
        labour_amount = avg * labor_rate * _DEFAULT_PROJECT_DAYS

    # Contingency: larger when rain is forecast and weather-sensitive materials exist.
    w = context.weather(site)
    sensitive = any(m.weather_sensitive for m in materials)
    pct = 0.12 if (w.get("will_rain") and sensitive) else (0.10 if sensitive else 0.08)
    contingency_amount = (materials_amount + labour_amount) * pct

    total = materials_amount + labour_amount + contingency_amount
    rationale = (
        f"Estimated from {len(materials)} materials (target stock × best vendor price × "
        f"{_TURNOVER:g} turnover ≈ {_money(materials_amount)}), labour "
        f"({_money(labour_amount)}, extrapolated from {prog:g}% progress at "
        f"{_money(labor_rate)}/worker-day), and a {round(pct * 100)}% contingency for "
        f"{'rain-exposed' if (w.get('will_rain') and sensitive) else 'standard'} conditions."
    )
    return {
        "total_amount": round(total, 2),
        "materials_amount": round(materials_amount, 2),
        "labour_amount": round(labour_amount, 2),
        "contingency_amount": round(contingency_amount, 2),
        "labor_rate": labor_rate,
        "source": "ai",
        "rationale": rationale,
    }


def _claude_budget(client, db: Session, site: Site, baseline: dict) -> dict:
    ctx = context.full_context(db, site, settings.labor_rate_per_worker_day)
    prompt = (
        "You are a construction cost estimator. Propose a realistic TOTAL project "
        "budget for this site, split into materials, labour and contingency (₹). "
        "Connect vendor prices, current stock, labour headcount, schedule progress "
        "and weather risk. Here is the live data:\n\n"
        f"{json.dumps(ctx, default=str)}\n\n"
        f"A rule-based baseline for reference: {json.dumps(baseline, default=str)}\n\n"
        "Return materials_amount, labour_amount, contingency_amount and a one-sentence "
        "rationale that names the main drivers."
    )
    response = client.messages.create(
        model=settings.ai_model,
        max_tokens=1024,
        messages=[{"role": "user", "content": prompt}],
        output_config={"format": {"type": "json_schema", "schema": _BUDGET_SCHEMA}},
    )
    text = next((b.text for b in response.content if b.type == "text"), "")
    data = json.loads(text)
    m = max(0.0, float(data["materials_amount"]))
    l = max(0.0, float(data["labour_amount"]))
    c = max(0.0, float(data["contingency_amount"]))
    return {
        "total_amount": round(m + l + c, 2),
        "materials_amount": round(m, 2),
        "labour_amount": round(l, 2),
        "contingency_amount": round(c, 2),
        "labor_rate": settings.labor_rate_per_worker_day,
        "source": "ai",
        "rationale": str(data.get("rationale") or baseline["rationale"]),
    }


def propose_budget(db: Session, site: Site) -> dict:
    """An AI-proposed budget (Claude when configured, else the heuristic)."""
    baseline = _heuristic_budget(db, site)
    client = get_client()
    if client is None:
        return baseline
    try:
        return _claude_budget(client, db, site, baseline)
    except Exception:
        return baseline


def build_forecast(db: Session, site: Site, budget: Budget) -> dict:
    rate = budget.labor_rate or settings.labor_rate_per_worker_day
    spend = context.spend_summary(db, site, rate)
    material_spend = spend["material_delivered"]
    labour_spend = spend["labour_spend"]
    committed = spend["material_committed"]
    spent_total = material_spend + labour_spend

    progress = context.site_progress(db, site)["latest_progress"] or 0
    if progress >= 5:
        projected = spent_total / (progress / 100.0) + committed
    else:
        projected = spent_total + committed

    total_budget = budget.total_amount or 1.0
    utilization = round((spent_total + committed) / total_budget * 100, 1)
    on_track = projected <= total_budget * 1.02

    w = context.weather(site)
    drivers = []
    if w.get("will_rain"):
        drivers.append("rain may lift material costs")
    if committed > 0:
        drivers.append(f"{_money(committed)} in open orders")
    drv = (" Drivers: " + "; ".join(drivers) + ".") if drivers else ""
    if on_track:
        insight = (
            f"On track — projected final spend {_money(projected)} vs a "
            f"{_money(budget.total_amount)} budget at {progress:g}% complete.{drv}"
        )
    else:
        over = max(0.0, projected - budget.total_amount)
        insight = (
            f"Overrun risk — projected {_money(projected)} exceeds the "
            f"{_money(budget.total_amount)} budget by {_money(over)} at "
            f"{progress:g}% complete.{drv}"
        )

    return {
        "spend": {
            "materials": material_spend,
            "labour": labour_spend,
            "total": round(spent_total, 2),
        },
        "committed": committed,
        "utilization_percent": utilization,
        "projected_total": round(projected, 2),
        "on_track": on_track,
        "insight": insight,
        "used_ai": ai_enabled(),
    }
