"""Stock movement ledger: record usage/deliveries and read usage trends."""
from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user, require_role
from ..models import Material, MovementType, Role, StockMovement, User
from ..schemas import MovementCreate, MovementOut

router = APIRouter(prefix="/stock", tags=["stock"])


def _signed_quantity(movement_type: MovementType, amount: float) -> float:
    """Apply the correct sign based on movement type (see MovementCreate docs)."""
    if movement_type == MovementType.CONSUMPTION:
        return -abs(amount)
    if movement_type in (MovementType.DELIVERY, MovementType.INITIAL):
        return abs(amount)
    return amount  # ADJUSTMENT: caller controls the sign


@router.post("/movements", response_model=MovementOut, status_code=status.HTTP_201_CREATED)
def record_movement(
    payload: MovementCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(Role.STOCK_HANDLER, Role.MANAGER)),
) -> StockMovement:
    material = db.get(Material, payload.material_id)
    if material is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Material not found")

    signed = _signed_quantity(payload.movement_type, payload.quantity)
    new_balance = material.current_stock + signed

    material.current_stock = new_balance
    movement = StockMovement(
        material_id=material.id,
        quantity=signed,
        movement_type=payload.movement_type,
        note=payload.note,
        balance_after=new_balance,
        created_by_id=user.id,
    )
    db.add(movement)
    db.commit()
    db.refresh(movement)
    return movement


@router.get("/movements", response_model=list[MovementOut])
def list_movements(
    material_id: int | None = None,
    limit: int = 100,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[StockMovement]:
    stmt = select(StockMovement).order_by(StockMovement.created_at.desc()).limit(min(limit, 500))
    if material_id is not None:
        stmt = stmt.where(StockMovement.material_id == material_id)
    return list(db.scalars(stmt).all())


@router.get("/daily-usage")
def daily_usage(
    material_id: int,
    days: int = 14,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[dict]:
    """Per-day consumption vs. delivery for a material (feeds the usage chart).

    The manager uses this to spot anomalies, e.g. a day where cement consumption
    spikes far above the norm (possible theft / wastage).
    """
    since = datetime.now(timezone.utc) - timedelta(days=days)
    stmt = (
        select(StockMovement)
        .where(StockMovement.material_id == material_id, StockMovement.created_at >= since)
        .order_by(StockMovement.created_at)
    )
    movements = db.scalars(stmt).all()

    consumed: dict[str, float] = defaultdict(float)
    delivered: dict[str, float] = defaultdict(float)
    for m in movements:
        day = m.created_at.date().isoformat()
        if m.movement_type == MovementType.CONSUMPTION:
            consumed[day] += abs(m.quantity)
        elif m.movement_type in (MovementType.DELIVERY, MovementType.INITIAL):
            delivered[day] += abs(m.quantity)

    # Build a continuous series so the chart has no gaps.
    today = datetime.now(timezone.utc).date()
    series = []
    for i in range(days, -1, -1):
        day = (today - timedelta(days=i)).isoformat()
        series.append({"date": day, "consumed": consumed.get(day, 0.0), "delivered": delivered.get(day, 0.0)})
    return series
