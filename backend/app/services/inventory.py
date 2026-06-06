"""Batch-level inventory: create batches on intake, draw down FIFO on consumption,
and classify batches by expiry. Stock-on-hand is always the sum of batch remainders.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..models import Material, StockBatch

# A batch within this many days of expiry is flagged "expiring soon".
EXPIRY_SOON_DAYS = 14


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _as_utc(dt: datetime | None) -> datetime | None:
    """SQLite returns naive datetimes; treat those as UTC so math stays consistent."""
    if dt is not None and dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


def add_batch(
    db: Session,
    material: Material,
    quantity: float,
    *,
    received_at: datetime | None = None,
    note: str | None = None,
) -> StockBatch:
    """Record an incoming lot. Expiry is derived from the material's shelf life."""
    received_at = received_at or _utcnow()
    expiry = None
    if material.shelf_life_days:
        expiry = received_at + timedelta(days=material.shelf_life_days)
    batch = StockBatch(
        material_id=material.id,
        original_quantity=quantity,
        remaining_quantity=quantity,
        received_at=received_at,
        expiry_date=expiry,
        note=note,
    )
    db.add(batch)
    return batch


def consume_fifo(db: Session, material: Material, quantity: float) -> float:
    """Reduce batches oldest-expiry-first. Returns the amount actually consumed."""
    remaining = quantity
    batches = db.scalars(
        select(StockBatch)
        .where(StockBatch.material_id == material.id, StockBatch.remaining_quantity > 0)
        # Soonest expiry first; non-perishable (NULL) batches last; then FIFO by receipt.
        .order_by(
            StockBatch.expiry_date.is_(None).asc(),
            StockBatch.expiry_date.asc(),
            StockBatch.received_at.asc(),
        )
    ).all()
    for batch in batches:
        if remaining <= 0:
            break
        take = min(batch.remaining_quantity, remaining)
        batch.remaining_quantity = round(batch.remaining_quantity - take, 4)
        remaining = round(remaining - take, 4)
    return round(quantity - remaining, 4)


def recompute_stock(db: Session, material: Material) -> float:
    """Set and return current_stock = sum of remaining batch quantities (source of truth)."""
    db.flush()  # make pending batch inserts/updates visible to the SUM (autoflush is off)
    total = db.scalar(
        select(func.coalesce(func.sum(StockBatch.remaining_quantity), 0.0)).where(
            StockBatch.material_id == material.id
        )
    )
    material.current_stock = round(float(total or 0.0), 4)
    return material.current_stock


def expiry_status(expiry_date: datetime | None, *, now: datetime | None = None) -> str:
    """Classify a batch: 'fresh' | 'expiring' | 'expired'."""
    expiry_date = _as_utc(expiry_date)
    if expiry_date is None:
        return "fresh"
    now = now or _utcnow()
    if expiry_date < now:
        return "expired"
    if expiry_date <= now + timedelta(days=EXPIRY_SOON_DAYS):
        return "expiring"
    return "fresh"


def days_to_expiry(expiry_date: datetime | None, *, now: datetime | None = None) -> int | None:
    expiry_date = _as_utc(expiry_date)
    if expiry_date is None:
        return None
    now = now or _utcnow()
    return (expiry_date - now).days
