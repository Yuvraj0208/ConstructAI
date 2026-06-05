"""Pydantic schemas: the request/response contracts for the API."""
from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from .models import MovementType, POStatus, Role


# --------------------------------------------------------------------------- #
# Auth / users
# --------------------------------------------------------------------------- #
class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    full_name: str = Field(min_length=1)
    role: Role
    city: str | None = None
    industry_id: int | None = None
    # Optional display name for the vendor profile created alongside a vendor user.
    company_name: str | None = None


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: EmailStr
    full_name: str
    role: Role
    city: str | None = None
    industry_id: int | None = None
    is_active: bool
    created_at: datetime


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


# --------------------------------------------------------------------------- #
# Industries
# --------------------------------------------------------------------------- #
class IndustryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    slug: str


# --------------------------------------------------------------------------- #
# Materials
# --------------------------------------------------------------------------- #
class MaterialCreate(BaseModel):
    name: str
    unit: str
    threshold: float = 0.0
    target_stock: float = 0.0
    weather_sensitive: bool = False
    industry_id: int
    initial_stock: float = 0.0


class MaterialUpdate(BaseModel):
    name: str | None = None
    unit: str | None = None
    threshold: float | None = None
    target_stock: float | None = None
    weather_sensitive: bool | None = None


class MaterialOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    unit: str
    current_stock: float
    threshold: float
    target_stock: float
    weather_sensitive: bool
    industry_id: int
    status: str
    created_at: datetime


# --------------------------------------------------------------------------- #
# Stock movements
# --------------------------------------------------------------------------- #
class MovementCreate(BaseModel):
    material_id: int
    movement_type: MovementType
    # Enter a positive amount; the server applies the correct sign by type.
    # (ADJUSTMENT keeps the sign you send, so it can be + or -.)
    quantity: float
    note: str | None = None


class MovementOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    material_id: int
    quantity: float
    movement_type: MovementType
    note: str | None = None
    balance_after: float
    created_at: datetime
    created_by_id: int | None = None


# --------------------------------------------------------------------------- #
# Vendors & offers
# --------------------------------------------------------------------------- #
class VendorOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    city: str | None = None
    rating: float
    industry_id: int | None = None


class OfferCreate(BaseModel):
    material_id: int
    price_per_unit: float = Field(gt=0)
    eta_days: int = Field(ge=0)
    available_quantity: float = Field(gt=0)


class OfferOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    vendor_id: int
    material_id: int
    price_per_unit: float
    eta_days: int
    available_quantity: float
    is_active: bool
    created_at: datetime
    # Convenience fields for the UI (filled in by the router).
    material_name: str | None = None
    vendor_name: str | None = None


# --------------------------------------------------------------------------- #
# Purchase orders (procurement engine output)
# --------------------------------------------------------------------------- #
class PurchaseOrderOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    material_id: int
    vendor_id: int
    quantity: float
    price_per_unit: float
    total_price: float
    eta_days: int
    status: POStatus
    rationale: str | None = None
    created_at: datetime
    decided_at: datetime | None = None
    material_name: str | None = None
    vendor_name: str | None = None


# --------------------------------------------------------------------------- #
# Weather
# --------------------------------------------------------------------------- #
class WeatherDay(BaseModel):
    date: str
    condition: str
    precipitation_mm: float
    temp_max_c: float | None = None
    rain: bool


class WeatherOut(BaseModel):
    city: str
    source: str  # "live" or "simulated"
    condition: str
    temp_c: float | None = None
    precipitation_mm: float
    will_rain: bool
    days: list[WeatherDay] = []
    # Weather-sensitive materials that get a rain buffer when rain is forecast.
    advisory: list[str] = []


class RunResult(BaseModel):
    message: str
    suggestions: list[PurchaseOrderOut] = []
    weather: WeatherOut | None = None
