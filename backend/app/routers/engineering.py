"""Site engineer endpoints: daily updates (to manager) and material requests
(which the stock handler issues, drawing down stock)."""
from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user, require_role
from ..models import (
    DailyUpdate,
    Material,
    MaterialRequest,
    MaterialRequestItem,
    MovementType,
    RequestStatus,
    Role,
    StockMovement,
    User,
)
from ..schemas import (
    DailyUpdateCreate,
    DailyUpdateOut,
    MaterialRequestCreate,
    MaterialRequestItemOut,
    MaterialRequestOut,
)
from ..services.inventory import consume_fifo, recompute_stock

router = APIRouter(prefix="/engineering", tags=["engineering"])


# --------------------------------------------------------------------------- #
# Daily updates
# --------------------------------------------------------------------------- #
def _update_to_out(u: DailyUpdate) -> DailyUpdateOut:
    return DailyUpdateOut(
        id=u.id,
        site_id=u.site_id,
        author_id=u.author_id,
        author_name=u.author.full_name if u.author else None,
        progress_percent=u.progress_percent,
        summary=u.summary,
        labor_count=u.labor_count,
        issues=u.issues,
        weather_impact=u.weather_impact,
        created_at=u.created_at,
    )


@router.post("/daily-updates", response_model=DailyUpdateOut, status_code=status.HTTP_201_CREATED)
def create_daily_update(
    payload: DailyUpdateCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(Role.SITE_ENGINEER)),
) -> DailyUpdateOut:
    update = DailyUpdate(
        site_id=payload.site_id,
        author_id=user.id,
        progress_percent=payload.progress_percent,
        summary=payload.summary,
        labor_count=payload.labor_count,
        issues=payload.issues,
        weather_impact=payload.weather_impact,
    )
    db.add(update)
    db.commit()
    db.refresh(update)
    return _update_to_out(update)


@router.get("/daily-updates", response_model=list[DailyUpdateOut])
def list_daily_updates(
    site_id: int,
    limit: int = 20,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[DailyUpdateOut]:
    stmt = (
        select(DailyUpdate)
        .where(DailyUpdate.site_id == site_id)
        .order_by(DailyUpdate.created_at.desc())
        .limit(min(limit, 100))
    )
    return [_update_to_out(u) for u in db.scalars(stmt).all()]


# --------------------------------------------------------------------------- #
# Material requests
# --------------------------------------------------------------------------- #
def _request_to_out(req: MaterialRequest, requester_name: str | None) -> MaterialRequestOut:
    return MaterialRequestOut(
        id=req.id,
        site_id=req.site_id,
        requested_by_id=req.requested_by_id,
        requester_name=requester_name,
        status=req.status,
        needed_for=req.needed_for,
        note=req.note,
        created_at=req.created_at,
        decided_at=req.decided_at,
        items=[
            MaterialRequestItemOut(
                material_id=i.material_id,
                material_name=i.material.name if i.material else None,
                unit=i.material.unit if i.material else None,
                quantity=i.quantity,
            )
            for i in req.items
        ],
    )


@router.post("/material-requests", response_model=MaterialRequestOut, status_code=status.HTTP_201_CREATED)
def create_material_request(
    payload: MaterialRequestCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(Role.SITE_ENGINEER)),
) -> MaterialRequestOut:
    req = MaterialRequest(
        site_id=payload.site_id,
        requested_by_id=user.id,
        needed_for=payload.needed_for,
        note=payload.note,
    )
    db.add(req)
    db.flush()

    for item in payload.items:
        material = db.get(Material, item.material_id)
        if material is None or material.site_id != payload.site_id:
            raise HTTPException(status_code=400, detail=f"Material {item.material_id} is not on this site")
        db.add(MaterialRequestItem(request_id=req.id, material_id=item.material_id, quantity=item.quantity))

    db.commit()
    db.refresh(req)
    return _request_to_out(req, user.full_name)


@router.get("/material-requests", response_model=list[MaterialRequestOut])
def list_material_requests(
    site_id: int,
    status_filter: RequestStatus | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[MaterialRequestOut]:
    stmt = (
        select(MaterialRequest)
        .where(MaterialRequest.site_id == site_id)
        .order_by(MaterialRequest.created_at.desc())
    )
    if status_filter is not None:
        stmt = stmt.where(MaterialRequest.status == status_filter)
    requests = list(db.scalars(stmt).all())

    requester_ids = {r.requested_by_id for r in requests if r.requested_by_id}
    names = {
        u.id: u.full_name
        for u in db.scalars(select(User).where(User.id.in_(requester_ids))).all()
    } if requester_ids else {}
    return [_request_to_out(r, names.get(r.requested_by_id)) for r in requests]


def _get_pending_request(db: Session, request_id: int) -> MaterialRequest:
    req = db.get(MaterialRequest, request_id)
    if req is None:
        raise HTTPException(status_code=404, detail="Request not found")
    if req.status != RequestStatus.PENDING:
        raise HTTPException(status_code=409, detail=f"Request already {req.status.value}")
    return req


@router.post("/material-requests/{request_id}/issue", response_model=MaterialRequestOut)
def issue_material_request(
    request_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(Role.STOCK_HANDLER, Role.MANAGER)),
) -> MaterialRequestOut:
    """Stock handler releases the requested materials — draws stock down FIFO."""
    req = _get_pending_request(db, request_id)

    for item in req.items:
        material = db.get(Material, item.material_id)
        if material is None:
            continue
        consumed = consume_fifo(db, material, item.quantity)
        balance = recompute_stock(db, material)
        db.add(
            StockMovement(
                material_id=material.id,
                quantity=-consumed,
                movement_type=MovementType.CONSUMPTION,
                note=f"Issued to site engineer · request #{req.id}",
                balance_after=balance,
                created_by_id=user.id,
            )
        )

    req.status = RequestStatus.ISSUED
    req.decided_at = datetime.now(timezone.utc)
    req.decided_by_id = user.id
    db.commit()
    db.refresh(req)
    requester = db.get(User, req.requested_by_id) if req.requested_by_id else None
    return _request_to_out(req, requester.full_name if requester else None)


@router.post("/material-requests/{request_id}/reject", response_model=MaterialRequestOut)
def reject_material_request(
    request_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(Role.STOCK_HANDLER, Role.MANAGER)),
) -> MaterialRequestOut:
    req = _get_pending_request(db, request_id)
    req.status = RequestStatus.REJECTED
    req.decided_at = datetime.now(timezone.utc)
    req.decided_by_id = user.id
    db.commit()
    db.refresh(req)
    requester = db.get(User, req.requested_by_id) if req.requested_by_id else None
    return _request_to_out(req, requester.full_name if requester else None)
