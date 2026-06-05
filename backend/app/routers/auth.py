"""Signup / login / current-user endpoints."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user
from ..models import Role, User, Vendor
from ..schemas import LoginRequest, Token, UserCreate, UserOut
from ..security import create_access_token, hash_password, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])


def _issue_token(user: User) -> Token:
    access_token = create_access_token(user.id, user.role.value)
    return Token(access_token=access_token, user=UserOut.model_validate(user))


@router.post("/signup", response_model=Token, status_code=status.HTTP_201_CREATED)
def signup(payload: UserCreate, db: Session = Depends(get_db)) -> Token:
    existing = db.scalar(select(User).where(User.email == payload.email))
    if existing is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

    user = User(
        email=payload.email,
        hashed_password=hash_password(payload.password),
        full_name=payload.full_name,
        role=payload.role,
        city=payload.city,
        industry_id=payload.industry_id,
    )
    db.add(user)
    db.flush()  # assigns user.id without committing yet

    # Vendors get a linked Vendor profile so they can post offers immediately.
    if user.role == Role.VENDOR:
        db.add(
            Vendor(
                name=payload.company_name or payload.full_name,
                city=payload.city,
                user_id=user.id,
                industry_id=payload.industry_id,
            )
        )

    db.commit()
    db.refresh(user)
    return _issue_token(user)


@router.post("/login", response_model=Token)
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> Token:
    user = db.scalar(select(User).where(User.email == payload.email))
    if user is None or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect email or password"
        )
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is disabled")
    return _issue_token(user)


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)) -> User:
    return user
