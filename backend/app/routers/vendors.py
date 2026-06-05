"""Vendor offers: vendors post price + ETA; managers view all offers."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user, require_role
from ..models import Material, Role, User, Vendor, VendorOffer
from ..schemas import OfferCreate, OfferOut, VendorOut

router = APIRouter(prefix="/vendors", tags=["vendors"])


def _offer_to_out(offer: VendorOffer) -> OfferOut:
    return OfferOut(
        id=offer.id,
        vendor_id=offer.vendor_id,
        material_id=offer.material_id,
        price_per_unit=offer.price_per_unit,
        eta_days=offer.eta_days,
        available_quantity=offer.available_quantity,
        is_active=offer.is_active,
        created_at=offer.created_at,
        material_name=offer.material.name if offer.material else None,
        vendor_name=offer.vendor.name if offer.vendor else None,
    )


def _current_vendor(db: Session, user: User) -> Vendor:
    vendor = db.scalar(select(Vendor).where(Vendor.user_id == user.id))
    if vendor is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No vendor profile linked to this account",
        )
    return vendor


@router.get("", response_model=list[VendorOut])
def list_vendors(
    db: Session = Depends(get_db),
    _: User = Depends(require_role(Role.MANAGER)),
) -> list[Vendor]:
    return list(db.scalars(select(Vendor).order_by(Vendor.name)).all())


@router.get("/offers", response_model=list[OfferOut])
def list_offers(
    material_id: int | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[OfferOut]:
    """Managers see every active offer; vendors see only their own offers."""
    stmt = select(VendorOffer).order_by(VendorOffer.created_at.desc())

    if user.role == Role.VENDOR:
        vendor = _current_vendor(db, user)
        stmt = stmt.where(VendorOffer.vendor_id == vendor.id)
    elif user.role == Role.MANAGER:
        stmt = stmt.where(VendorOffer.is_active.is_(True))
    else:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not permitted")

    if material_id is not None:
        stmt = stmt.where(VendorOffer.material_id == material_id)

    return [_offer_to_out(o) for o in db.scalars(stmt).all()]


@router.post("/offers", response_model=OfferOut, status_code=status.HTTP_201_CREATED)
def create_offer(
    payload: OfferCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(Role.VENDOR)),
) -> OfferOut:
    vendor = _current_vendor(db, user)

    material = db.get(Material, payload.material_id)
    if material is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Material not found")

    offer = VendorOffer(
        vendor_id=vendor.id,
        material_id=payload.material_id,
        price_per_unit=payload.price_per_unit,
        eta_days=payload.eta_days,
        available_quantity=payload.available_quantity,
    )
    db.add(offer)
    db.commit()
    db.refresh(offer)
    return _offer_to_out(offer)


@router.delete("/offers/{offer_id}", status_code=status.HTTP_204_NO_CONTENT)
def withdraw_offer(
    offer_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(Role.VENDOR)),
) -> None:
    vendor = _current_vendor(db, user)
    offer = db.get(VendorOffer, offer_id)
    if offer is None or offer.vendor_id != vendor.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Offer not found")
    offer.is_active = False
    db.commit()
