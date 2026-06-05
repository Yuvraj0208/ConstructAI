"""Industry catalog — lets the platform serve construction, electrical, etc."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Industry
from ..schemas import IndustryOut

router = APIRouter(prefix="/industries", tags=["industries"])


@router.get("", response_model=list[IndustryOut])
def list_industries(db: Session = Depends(get_db)) -> list[Industry]:
    # Public so the signup screen can show the industry dropdown.
    return list(db.scalars(select(Industry).order_by(Industry.name)).all())
