"""Site engineer endpoints: daily updates (to manager) and material requests
(which the stock handler issues, drawing down stock)."""
from __future__ import annotations

import base64
import json
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
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
    SiteImageReport,
    StockMovement,
    User,
)
from ..schemas import (
    DailyUpdateCreate,
    DailyUpdateOut,
    MaterialRequestCreate,
    MaterialRequestItemOut,
    MaterialRequestOut,
    SiteImageReportDetail,
    SiteImageReportOut,
)
from ..services.ai.vision import analyze_site_image
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


# --------------------------------------------------------------------------- #
# Site photos — AI vision progress reports
# --------------------------------------------------------------------------- #
MAX_IMAGE_BYTES = 6 * 1024 * 1024  # 6 MB (stored base64 in Postgres)


def _photo_to_out(r: SiteImageReport, author_name: str | None) -> SiteImageReportOut:
    return SiteImageReportOut(
        id=r.id,
        site_id=r.site_id,
        author_id=r.author_id,
        author_name=author_name,
        caption=r.caption,
        media_type=r.media_type,
        progress_estimate=r.progress_estimate,
        summary=r.summary,
        observations=json.loads(r.observations or "[]"),
        safety_flags=json.loads(r.safety_flags or "[]"),
        materials_visible=json.loads(r.materials_visible or "[]"),
        status=r.status,
        used_ai=r.used_ai,
        created_at=r.created_at,
    )


def _photo_to_detail(r: SiteImageReport, author_name: str | None) -> SiteImageReportDetail:
    base = _photo_to_out(r, author_name)
    return SiteImageReportDetail(
        **base.model_dump(),
        image_data_url=f"data:{r.media_type};base64,{r.image_b64}",
    )


@router.post(
    "/site-photos", response_model=SiteImageReportDetail, status_code=status.HTTP_201_CREATED
)
def upload_site_photo(
    site_id: int = Form(...),
    caption: str | None = Form(None),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(require_role(Role.SITE_ENGINEER)),
) -> SiteImageReportDetail:
    """Engineer uploads a progress photo; an AI vision report is generated + stored."""
    media_type = file.content_type or "image/jpeg"
    if not media_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Please upload an image file.")
    data = file.file.read()
    if not data:
        raise HTTPException(status_code=400, detail="The uploaded file is empty.")
    if len(data) > MAX_IMAGE_BYTES:
        raise HTTPException(status_code=413, detail="Image too large (max 6 MB).")

    report = analyze_site_image(data, media_type)
    row = SiteImageReport(
        site_id=site_id,
        author_id=user.id,
        media_type=media_type,
        image_b64=base64.standard_b64encode(data).decode("ascii"),
        caption=caption,
        progress_estimate=report["progress_estimate"],
        summary=report["summary"],
        observations=json.dumps(report["observations"]),
        safety_flags=json.dumps(report["safety_flags"]),
        materials_visible=json.dumps(report["materials_visible"]),
        status=report["status"],
        used_ai=report["used_ai"],
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _photo_to_detail(row, user.full_name)


@router.get("/site-photos", response_model=list[SiteImageReportOut])
def list_site_photos(
    site_id: int,
    limit: int = 12,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[SiteImageReportOut]:
    """Photo reports for a site (metadata only — images are fetched on demand)."""
    rows = list(
        db.scalars(
            select(SiteImageReport)
            .where(SiteImageReport.site_id == site_id)
            .order_by(SiteImageReport.created_at.desc())
            .limit(min(limit, 50))
        ).all()
    )
    author_ids = {r.author_id for r in rows if r.author_id}
    names = (
        {
            u.id: u.full_name
            for u in db.scalars(select(User).where(User.id.in_(author_ids))).all()
        }
        if author_ids
        else {}
    )
    return [_photo_to_out(r, names.get(r.author_id)) for r in rows]


@router.get("/site-photos/{report_id}", response_model=SiteImageReportDetail)
def get_site_photo(
    report_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> SiteImageReportDetail:
    """A single report including the image (data URL) for inline display."""
    r = db.get(SiteImageReport, report_id)
    if r is None:
        raise HTTPException(status_code=404, detail="Report not found")
    author = db.get(User, r.author_id) if r.author_id else None
    return _photo_to_detail(r, author.full_name if author else None)
