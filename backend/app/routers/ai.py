"""AI layer endpoints: status, natural-language insights, and AI budgeting.

Every endpoint degrades gracefully to a rule-based result when no Claude key is
configured, so the public demo never errors.
"""
from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import settings
from ..database import get_db
from ..deps import require_role
from ..models import Budget, PurchaseOrder, Role, Site, User
from ..schemas import (
    AiStatusOut,
    AskRequest,
    AskResponse,
    AskSource,
    BudgetForecastOut,
    BudgetOut,
    BudgetUpdate,
    NoteHit,
    NoteSearchOut,
    PurchaseOrderOut,
    SpendBreakdown,
)
from ..services.ai import ask as ai_ask
from ..services.ai import build_forecast, propose_budget
from ..services.ai.client import ai_enabled
from ..services.ai.draft import draft_orders
from ..services.ai.notes import search_notes

router = APIRouter(prefix="/ai", tags=["ai"])


def _get_site(db: Session, site_id: int) -> Site:
    site = db.get(Site, site_id)
    if site is None:
        raise HTTPException(status_code=404, detail="Site not found")
    return site


def _apply_proposal(db: Session, site: Site, proposal: dict) -> Budget:
    budget = db.scalar(select(Budget).where(Budget.site_id == site.id))
    if budget is None:
        budget = Budget(site_id=site.id)
        db.add(budget)
    budget.total_amount = proposal["total_amount"]
    budget.materials_amount = proposal["materials_amount"]
    budget.labour_amount = proposal["labour_amount"]
    budget.contingency_amount = proposal["contingency_amount"]
    budget.labor_rate = proposal["labor_rate"]
    budget.source = proposal.get("source", "ai")
    budget.rationale = proposal.get("rationale")
    budget.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(budget)
    return budget


def _forecast_out(db: Session, site: Site, budget: Budget) -> BudgetForecastOut:
    f = build_forecast(db, site, budget)
    return BudgetForecastOut(
        budget=BudgetOut.model_validate(budget),
        spend=SpendBreakdown(**f["spend"]),
        committed=f["committed"],
        utilization_percent=f["utilization_percent"],
        projected_total=f["projected_total"],
        on_track=f["on_track"],
        insight=f["insight"],
        used_ai=f["used_ai"],
    )


@router.get("/status", response_model=AiStatusOut)
def ai_status() -> AiStatusOut:
    return AiStatusOut(enabled=ai_enabled(), model=settings.ai_model)


@router.post("/ask", response_model=AskResponse)
def ask_insight(
    payload: AskRequest,
    db: Session = Depends(get_db),
    _: User = Depends(require_role(Role.MANAGER)),
) -> AskResponse:
    site = _get_site(db, payload.site_id)
    result = ai_ask(db, site, payload.question)
    return AskResponse(
        answer=result["answer"],
        sources=[AskSource(**s) for s in result.get("sources", [])],
        used_ai=result.get("used_ai", False),
    )


@router.get("/budget", response_model=BudgetForecastOut)
def get_budget(
    site_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_role(Role.MANAGER)),
) -> BudgetForecastOut:
    site = _get_site(db, site_id)
    budget = db.scalar(select(Budget).where(Budget.site_id == site.id))
    if budget is None:  # first visit — generate the AI proposal
        budget = _apply_proposal(db, site, propose_budget(db, site))
    return _forecast_out(db, site, budget)


@router.post("/budget/propose", response_model=BudgetForecastOut)
def repropose_budget(
    site_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_role(Role.MANAGER)),
) -> BudgetForecastOut:
    site = _get_site(db, site_id)
    budget = _apply_proposal(db, site, propose_budget(db, site))
    return _forecast_out(db, site, budget)


@router.patch("/budget/{budget_id}", response_model=BudgetForecastOut)
def update_budget(
    budget_id: int,
    payload: BudgetUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_role(Role.MANAGER)),
) -> BudgetForecastOut:
    budget = db.get(Budget, budget_id)
    if budget is None:
        raise HTTPException(status_code=404, detail="Budget not found")

    data = payload.model_dump(exclude_unset=True)
    for field in ("materials_amount", "labour_amount", "contingency_amount", "labor_rate"):
        if data.get(field) is not None:
            setattr(budget, field, data[field])
    # Explicit total wins; otherwise keep total = sum of the category amounts.
    if data.get("total_amount") is not None:
        budget.total_amount = data["total_amount"]
    else:
        budget.total_amount = round(
            budget.materials_amount + budget.labour_amount + budget.contingency_amount, 2
        )
    budget.source = "manual"
    budget.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(budget)
    return _forecast_out(db, budget.site, budget)


@router.get("/notes/search", response_model=NoteSearchOut)
def notes_search(
    site_id: int,
    q: str,
    db: Session = Depends(get_db),
    _: User = Depends(require_role(Role.MANAGER)),
) -> NoteSearchOut:
    """Keyword-search a site's free-text history (daily updates, requests, notes…)."""
    site = _get_site(db, site_id)
    return NoteSearchOut(query=q, hits=[NoteHit(**h) for h in search_notes(db, site, q)])


def _po_out(po: PurchaseOrder) -> PurchaseOrderOut:
    return PurchaseOrderOut(
        id=po.id,
        material_id=po.material_id,
        vendor_id=po.vendor_id,
        quantity=po.quantity,
        price_per_unit=po.price_per_unit,
        total_price=po.total_price,
        eta_days=po.eta_days,
        status=po.status,
        rationale=po.rationale,
        created_at=po.created_at,
        decided_at=po.decided_at,
        material_name=po.material.name if po.material else None,
        vendor_name=po.vendor.name if po.vendor else None,
    )


@router.post("/draft-orders", response_model=list[PurchaseOrderOut])
def ai_draft_orders(
    site_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_role(Role.MANAGER)),
) -> list[PurchaseOrderOut]:
    """AI-draft SUGGESTED purchase orders for the manager to approve."""
    site = _get_site(db, site_id)
    return [_po_out(po) for po in draft_orders(db, site)]
