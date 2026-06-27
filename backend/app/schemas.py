"""Pydantic schemas: the request/response contracts for the API."""
from __future__ import annotations

from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from .models import MovementType, POStatus, RequestStatus, Role


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


class SiteOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    code: str | None = None
    city: str | None = None
    industry_id: int
    is_active: bool


# --------------------------------------------------------------------------- #
# Materials
# --------------------------------------------------------------------------- #
class MaterialCreate(BaseModel):
    name: str
    unit: str
    threshold: float = 0.0
    target_stock: float = 0.0
    weather_sensitive: bool = False
    shelf_life_days: int | None = None
    reserve_percent: float = 0.0
    site_id: int
    initial_stock: float = 0.0


class MaterialUpdate(BaseModel):
    name: str | None = None
    unit: str | None = None
    threshold: float | None = None
    target_stock: float | None = None
    weather_sensitive: bool | None = None
    shelf_life_days: int | None = None
    reserve_percent: float | None = None


class MaterialOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    unit: str
    current_stock: float
    threshold: float
    target_stock: float
    weather_sensitive: bool
    shelf_life_days: int | None = None
    reserve_percent: float
    reserved_quantity: float
    available_stock: float
    below_reserve: bool
    site_id: int
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
# Stock batches (expiry / FIFO)
# --------------------------------------------------------------------------- #
class StockBatchOut(BaseModel):
    id: int
    material_id: int
    material_name: str | None = None
    unit: str | None = None
    original_quantity: float
    remaining_quantity: float
    received_at: datetime
    expiry_date: datetime | None = None
    days_to_expiry: int | None = None
    expiry_status: str  # fresh | expiring | expired
    note: str | None = None


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


# --------------------------------------------------------------------------- #
# Site engineer: daily updates
# --------------------------------------------------------------------------- #
class DailyUpdateCreate(BaseModel):
    site_id: int
    progress_percent: float = Field(ge=0, le=100)
    summary: str = Field(min_length=1)
    labor_count: int = Field(default=0, ge=0)
    issues: str | None = None
    weather_impact: str | None = None


class DailyUpdateOut(BaseModel):
    id: int
    site_id: int
    author_id: int | None = None
    author_name: str | None = None
    progress_percent: float
    summary: str
    labor_count: int
    issues: str | None = None
    weather_impact: str | None = None
    created_at: datetime


# --------------------------------------------------------------------------- #
# Site engineer: material requests
# --------------------------------------------------------------------------- #
class MaterialRequestItemIn(BaseModel):
    material_id: int
    quantity: float = Field(gt=0)


class MaterialRequestItemOut(BaseModel):
    material_id: int
    material_name: str | None = None
    unit: str | None = None
    quantity: float


class MaterialRequestCreate(BaseModel):
    site_id: int
    needed_for: str | None = None
    note: str | None = None
    items: list[MaterialRequestItemIn] = Field(min_length=1)


class MaterialRequestOut(BaseModel):
    id: int
    site_id: int
    requested_by_id: int | None = None
    requester_name: str | None = None
    status: RequestStatus
    needed_for: str | None = None
    note: str | None = None
    created_at: datetime
    decided_at: datetime | None = None
    items: list[MaterialRequestItemOut] = []


# --------------------------------------------------------------------------- #
# AI layer: status, budgeting, natural-language insights
# --------------------------------------------------------------------------- #
class AiStatusOut(BaseModel):
    enabled: bool  # True when a real Claude key is configured
    model: str


class BudgetOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    site_id: int
    total_amount: float
    materials_amount: float
    labour_amount: float
    contingency_amount: float
    labor_rate: float
    source: str  # ai | manual
    rationale: str | None = None
    created_at: datetime
    updated_at: datetime


class BudgetUpdate(BaseModel):
    total_amount: float | None = Field(default=None, ge=0)
    materials_amount: float | None = Field(default=None, ge=0)
    labour_amount: float | None = Field(default=None, ge=0)
    contingency_amount: float | None = Field(default=None, ge=0)
    labor_rate: float | None = Field(default=None, ge=0)


class SpendBreakdown(BaseModel):
    materials: float
    labour: float
    total: float


class BudgetForecastOut(BaseModel):
    budget: BudgetOut
    spend: SpendBreakdown          # ₹ already delivered/consumed
    committed: float               # approved/ordered POs not yet delivered
    utilization_percent: float     # (spend + committed) / total budget
    projected_total: float         # extrapolated final spend
    on_track: bool
    insight: str
    used_ai: bool


class AskRequest(BaseModel):
    site_id: int
    question: str = Field(min_length=1, max_length=500)


class AskSource(BaseModel):
    label: str
    detail: str | None = None


class AskResponse(BaseModel):
    answer: str
    sources: list[AskSource] = []
    used_ai: bool


# --------------------------------------------------------------------------- #
# AI layer: site-photo vision reports
# --------------------------------------------------------------------------- #
class SiteImageReportOut(BaseModel):
    id: int
    site_id: int
    author_id: int | None = None
    author_name: str | None = None
    caption: str | None = None
    media_type: str
    progress_estimate: float | None = None
    summary: str
    observations: list[str] = []
    safety_flags: list[str] = []
    materials_visible: list[str] = []
    status: str  # on_track | needs_attention | blocked | pending
    used_ai: bool
    created_at: datetime


class SiteImageReportDetail(SiteImageReportOut):
    image_data_url: str  # data:<mediatype>;base64,<...> for inline display


# --------------------------------------------------------------------------- #
# AI layer: note / daily-update search (keyword retrieval)
# --------------------------------------------------------------------------- #
class NoteHit(BaseModel):
    source: str  # e.g. "Daily update", "Material request", "Purchase order"
    text: str
    date: str | None = None
    score: float


class NoteSearchOut(BaseModel):
    query: str
    hits: list[NoteHit] = []


# --------------------------------------------------------------------------- #
# Schedule milestones
# --------------------------------------------------------------------------- #
class MilestoneCreate(BaseModel):
    site_id: int
    title: str = Field(min_length=1, max_length=160)
    target_date: date
    sort_order: int = 0


class MilestoneUpdate(BaseModel):
    title: str | None = Field(default=None, max_length=160)
    target_date: date | None = None
    status: str | None = None  # pending | done
    sort_order: int | None = None


class MilestoneOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    site_id: int
    title: str
    target_date: date
    status: str
    sort_order: int
    created_at: datetime


# --------------------------------------------------------------------------- #
# Multi-site portfolio rollup (executive overview)
# --------------------------------------------------------------------------- #
class PortfolioSiteOut(BaseModel):
    id: int
    name: str
    city: str | None = None
    industry_id: int
    materials_total: int
    low: int
    critical: int
    latest_progress: float | None = None
    milestones_overdue: int
    milestones_at_risk: int
    spend_total: float
    committed: float
    budget_total: float | None = None
    utilization_percent: float | None = None
    on_track: bool | None = None
    needs_attention: bool


class PortfolioTotals(BaseModel):
    sites: int
    critical: int
    low: int
    spend_total: float
    budget_total: float
    sites_need_attention: int


class PortfolioOut(BaseModel):
    sites: list[PortfolioSiteOut] = []
    totals: PortfolioTotals
    insight: str
