"""Schedule milestones for a site. Managers manage them; the AI reasons about
schedule risk by comparing target dates to the latest reported progress."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user, require_role
from ..models import Milestone, Role, Site, User
from ..schemas import MilestoneCreate, MilestoneOut, MilestoneUpdate

router = APIRouter(prefix="/schedule", tags=["schedule"])


@router.get("/milestones", response_model=list[MilestoneOut])
def list_milestones(
    site_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[Milestone]:
    return list(
        db.scalars(
            select(Milestone)
            .where(Milestone.site_id == site_id)
            .order_by(Milestone.sort_order, Milestone.target_date)
        ).all()
    )


@router.post("/milestones", response_model=MilestoneOut, status_code=status.HTTP_201_CREATED)
def create_milestone(
    payload: MilestoneCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_role(Role.MANAGER)),
) -> Milestone:
    if db.get(Site, payload.site_id) is None:
        raise HTTPException(status_code=404, detail="Site not found")
    m = Milestone(
        site_id=payload.site_id,
        title=payload.title,
        target_date=payload.target_date,
        sort_order=payload.sort_order,
    )
    db.add(m)
    db.commit()
    db.refresh(m)
    return m


@router.patch("/milestones/{milestone_id}", response_model=MilestoneOut)
def update_milestone(
    milestone_id: int,
    payload: MilestoneUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(Role.MANAGER, Role.SITE_ENGINEER)),
) -> Milestone:
    m = db.get(Milestone, milestone_id)
    if m is None:
        raise HTTPException(status_code=404, detail="Milestone not found")
    data = payload.model_dump(exclude_unset=True)
    # Engineers may only mark a milestone done; managers may edit everything.
    if user.role == Role.SITE_ENGINEER:
        data = {k: v for k, v in data.items() if k == "status"}
    for key, value in data.items():
        if value is not None:
            setattr(m, key, value)
    db.commit()
    db.refresh(m)
    return m


@router.delete("/milestones/{milestone_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_milestone(
    milestone_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_role(Role.MANAGER)),
) -> None:
    m = db.get(Milestone, milestone_id)
    if m is None:
        raise HTTPException(status_code=404, detail="Milestone not found")
    db.delete(m)
    db.commit()
