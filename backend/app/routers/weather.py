"""Weather endpoint — city forecast + which materials get a rain buffer."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user
from ..models import Material, User
from ..schemas import WeatherOut
from ..services.weather import get_forecast

router = APIRouter(prefix="/weather", tags=["weather"])


@router.get("", response_model=WeatherOut)
def weather(
    city: str | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> WeatherOut:
    target_city = city or user.city or "Mumbai"
    data = get_forecast(target_city)

    advisory: list[str] = []
    if data.get("will_rain") and user.industry_id is not None:
        sensitive = db.scalars(
            select(Material).where(
                Material.industry_id == user.industry_id,
                Material.weather_sensitive.is_(True),
            )
        ).all()
        advisory = [m.name for m in sensitive]

    return WeatherOut(**data, advisory=advisory)
