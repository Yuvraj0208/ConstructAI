"""Material catalog endpoints (list / create / update / detail)."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user, require_role
from ..models import Material, MovementType, Role, StockMovement, User
from ..schemas import MaterialCreate, MaterialOut, MaterialUpdate
from ..services.inventory import add_batch, recompute_stock

router = APIRouter(prefix="/materials", tags=["materials"])


@router.get("", response_model=list[MaterialOut])
def list_materials(
    site_id: int | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[Material]:
    stmt = select(Material).order_by(Material.name)
    if site_id is not None:
        stmt = stmt.where(Material.site_id == site_id)
    return list(db.scalars(stmt).all())


@router.get("/{material_id}", response_model=MaterialOut)
def get_material(
    material_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> Material:
    material = db.get(Material, material_id)
    if material is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Material not found")
    return material


@router.post("", response_model=MaterialOut, status_code=status.HTTP_201_CREATED)
def create_material(
    payload: MaterialCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(Role.MANAGER)),
) -> Material:
    material = Material(
        name=payload.name,
        unit=payload.unit,
        threshold=payload.threshold,
        target_stock=payload.target_stock,
        weather_sensitive=payload.weather_sensitive,
        shelf_life_days=payload.shelf_life_days,
        reserve_percent=payload.reserve_percent,
        site_id=payload.site_id,
        current_stock=0.0,
    )
    db.add(material)
    db.flush()

    if payload.initial_stock:
        add_batch(db, material, payload.initial_stock, note="Opening stock")
        recompute_stock(db, material)
        db.add(
            StockMovement(
                material_id=material.id,
                quantity=payload.initial_stock,
                movement_type=MovementType.INITIAL,
                note="Opening stock",
                balance_after=material.current_stock,
                created_by_id=user.id,
            )
        )

    db.commit()
    db.refresh(material)
    return material


@router.patch("/{material_id}", response_model=MaterialOut)
def update_material(
    material_id: int,
    payload: MaterialUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_role(Role.MANAGER)),
) -> Material:
    material = db.get(Material, material_id)
    if material is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Material not found")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(material, field, value)

    db.commit()
    db.refresh(material)
    return material
