"""Site endpoints — the sites a user can switch between."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user
from ..models import Site, User
from ..schemas import SiteOut

router = APIRouter(prefix="/sites", tags=["sites"])


@router.get("", response_model=list[SiteOut])
def list_sites(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[Site]:
    """Active sites the user may switch between (within their own industry)."""
    stmt = select(Site).where(Site.is_active.is_(True)).order_by(Site.name)
    if user.industry_id is not None:
        stmt = stmt.where(Site.industry_id == user.industry_id)
    return list(db.scalars(stmt).all())
