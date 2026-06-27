"""Multi-site portfolio rollup — an executive overview that aggregates stock
health, spend, progress and schedule risk across all of a manager's sites."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import settings
from ..database import get_db
from ..deps import require_role
from ..models import Budget, Role, Site, User
from ..schemas import PortfolioOut, PortfolioSiteOut, PortfolioTotals
from ..services.ai import context
from ..services.ai.budget import build_forecast

router = APIRouter(prefix="/portfolio", tags=["portfolio"])


@router.get("", response_model=PortfolioOut)
def get_portfolio(
    db: Session = Depends(get_db),
    user: User = Depends(require_role(Role.MANAGER)),
) -> PortfolioOut:
    stmt = select(Site).where(Site.is_active.is_(True))
    if user.industry_id is not None:  # company-scoped managers see only their industry
        stmt = stmt.where(Site.industry_id == user.industry_id)
    sites = list(db.scalars(stmt.order_by(Site.name)).all())

    rows: list[PortfolioSiteOut] = []
    for site in sites:
        sh = context.stock_health(db, site)
        counts = sh["counts"]
        sched = context.schedule(db, site)
        spend = context.spend_summary(db, site, settings.labor_rate_per_worker_day)

        util = on_track = budget_total = None
        budget = db.scalar(select(Budget).where(Budget.site_id == site.id))
        if budget:
            f = build_forecast(db, site, budget)
            util, on_track, budget_total = f["utilization_percent"], f["on_track"], budget.total_amount

        overdue = sum(
            1 for m in sched["milestones"] if (not m["done"]) and m["days_remaining"] < 0
        )
        critical = counts.get("critical", 0)
        spend_total = round(spend["material_delivered"] + spend["labour_spend"], 2)
        needs_attention = critical > 0 or overdue > 0 or on_track is False

        rows.append(
            PortfolioSiteOut(
                id=site.id,
                name=site.name,
                city=site.city,
                industry_id=site.industry_id,
                materials_total=len(sh["materials"]),
                low=counts.get("low", 0),
                critical=critical,
                latest_progress=sched["latest_progress"],
                milestones_overdue=overdue,
                milestones_at_risk=len(sched["at_risk"]),
                spend_total=spend_total,
                committed=spend["material_committed"],
                budget_total=budget_total,
                utilization_percent=util,
                on_track=on_track,
                needs_attention=needs_attention,
            )
        )

    totals = PortfolioTotals(
        sites=len(rows),
        critical=sum(r.critical for r in rows),
        low=sum(r.low for r in rows),
        spend_total=round(sum(r.spend_total for r in rows), 2),
        budget_total=round(sum(r.budget_total or 0 for r in rows), 2),
        sites_need_attention=sum(1 for r in rows if r.needs_attention),
    )

    flagged = [r for r in rows if r.needs_attention]
    if not rows:
        insight = "No sites yet."
    elif not flagged:
        insight = f"All {len(rows)} sites look healthy — no critical stock or overdue milestones."
    else:
        names = ", ".join(r.name for r in flagged[:3])
        more = "…" if len(flagged) > 3 else ""
        insight = (
            f"{len(flagged)} of {len(rows)} sites need attention — {names}{more}. "
            f"{totals.critical} critical material(s) across the portfolio."
        )

    return PortfolioOut(sites=rows, totals=totals, insight=insight)
