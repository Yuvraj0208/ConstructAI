"""Procurement endpoints: run the engine, list orders, approve/reject/receive."""
from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user, require_role
from ..models import (
    Material,
    MovementType,
    POStatus,
    PurchaseOrder,
    Role,
    Site,
    StockMovement,
    User,
    Vendor,
)
from ..schemas import PurchaseOrderOut, RunResult, WeatherOut
from ..services.inventory import add_batch, recompute_stock
from ..services.procurement import ensure_demo_orders, generate_suggestions

router = APIRouter(prefix="/procurement", tags=["procurement"])


def _po_to_out(po: PurchaseOrder) -> PurchaseOrderOut:
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


@router.post("/run", response_model=RunResult)
def run_engine(
    site_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_role(Role.MANAGER)),
) -> RunResult:
    """Generate suggested purchase orders for every low/critical material at a site."""
    site = db.get(Site, site_id)
    if site is None:
        raise HTTPException(status_code=404, detail="Site not found")

    created, weather, advisory = generate_suggestions(db, site)
    weather_out = WeatherOut(**weather, advisory=advisory)
    n_materials = len({po.material_id for po in created})

    if created:
        message = f"Generated {len(created)} suggested order(s) across {n_materials} material(s)."
    else:
        message = "All stock is healthy — no orders needed right now."

    return RunResult(
        message=message,
        suggestions=[_po_to_out(po) for po in created],
        weather=weather_out,
    )


@router.get("/orders", response_model=list[PurchaseOrderOut])
def list_orders(
    site_id: int | None = None,
    status_filter: POStatus | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[PurchaseOrderOut]:
    """Managers see all orders at the selected site; stock handlers see approved
    (incoming) ones to receive; vendors see orders directed to them."""
    # Backfill a demo procurement history the first time a site is viewed with none
    # (no-op once real orders exist, and disabled in tests via settings.demo_autoseed).
    if site_id is not None and user.role != Role.VENDOR:
        site = db.get(Site, site_id)
        if site is not None:
            ensure_demo_orders(db, site)

    if user.role == Role.VENDOR:
        vendor = db.scalar(select(Vendor).where(Vendor.user_id == user.id))
        stmt = (
            select(PurchaseOrder)
            .where(
                PurchaseOrder.vendor_id == (vendor.id if vendor else -1),
                PurchaseOrder.status != POStatus.SUGGESTED,
            )
            .order_by(PurchaseOrder.created_at.desc())
        )
    else:
        stmt = (
            select(PurchaseOrder)
            .join(Material, PurchaseOrder.material_id == Material.id)
            .order_by(PurchaseOrder.created_at.desc())
        )
        if site_id is not None:
            stmt = stmt.where(Material.site_id == site_id)
        if user.role == Role.STOCK_HANDLER:
            stmt = stmt.where(PurchaseOrder.status.in_([POStatus.APPROVED, POStatus.ORDERED]))

    if status_filter is not None:
        stmt = stmt.where(PurchaseOrder.status == status_filter)

    return [_po_to_out(po) for po in db.scalars(stmt).all()]


def _get_po(db: Session, po_id: int) -> PurchaseOrder:
    po = db.get(PurchaseOrder, po_id)
    if po is None:
        raise HTTPException(status_code=404, detail="Purchase order not found")
    return po


@router.post("/orders/{po_id}/approve", response_model=PurchaseOrderOut)
def approve_order(
    po_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(Role.MANAGER)),
) -> PurchaseOrderOut:
    po = _get_po(db, po_id)
    if po.status != POStatus.SUGGESTED:
        raise HTTPException(status_code=409, detail=f"Order is already {po.status.value}")
    po.status = POStatus.APPROVED
    po.decided_at = datetime.now(timezone.utc)
    po.decided_by_id = user.id
    db.commit()
    db.refresh(po)
    return _po_to_out(po)


@router.post("/orders/{po_id}/reject", response_model=PurchaseOrderOut)
def reject_order(
    po_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(Role.MANAGER)),
) -> PurchaseOrderOut:
    po = _get_po(db, po_id)
    if po.status != POStatus.SUGGESTED:
        raise HTTPException(status_code=409, detail=f"Order is already {po.status.value}")
    po.status = POStatus.REJECTED
    po.decided_at = datetime.now(timezone.utc)
    po.decided_by_id = user.id
    db.commit()
    db.refresh(po)
    return _po_to_out(po)


@router.post("/orders/{po_id}/accept", response_model=PurchaseOrderOut)
def accept_order(
    po_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(Role.VENDOR)),
) -> PurchaseOrderOut:
    """Vendor confirms an approved order — moves it to ORDERED (in transit)."""
    po = _get_po(db, po_id)
    vendor = db.scalar(select(Vendor).where(Vendor.user_id == user.id))
    if vendor is None or po.vendor_id != vendor.id:
        raise HTTPException(status_code=404, detail="Purchase order not found")
    if po.status != POStatus.APPROVED:
        raise HTTPException(status_code=409, detail=f"Order cannot be accepted from state {po.status.value}")
    po.status = POStatus.ORDERED
    db.commit()
    db.refresh(po)
    return _po_to_out(po)


@router.post("/orders/{po_id}/receive", response_model=PurchaseOrderOut)
def receive_order(
    po_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(Role.MANAGER, Role.STOCK_HANDLER)),
) -> PurchaseOrderOut:
    """Mark an approved order as delivered — adds the quantity to stock."""
    po = _get_po(db, po_id)
    if po.status not in (POStatus.APPROVED, POStatus.ORDERED):
        raise HTTPException(status_code=409, detail=f"Order cannot be received from state {po.status.value}")

    material = db.get(Material, po.material_id)
    if material is None:
        raise HTTPException(status_code=404, detail="Material not found")

    # Received goods become a new batch (with its own expiry); stock is recomputed.
    vendor_name = po.vendor.name if po.vendor else "vendor"
    add_batch(db, material, po.quantity, note=f"PO #{po.id} from {vendor_name}")
    new_balance = recompute_stock(db, material)
    db.add(
        StockMovement(
            material_id=material.id,
            quantity=po.quantity,
            movement_type=MovementType.DELIVERY,
            note=f"PO #{po.id} received from {vendor_name}",
            balance_after=new_balance,
            created_by_id=user.id,
        )
    )
    po.status = POStatus.DELIVERED
    po.decided_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(po)
    return _po_to_out(po)
