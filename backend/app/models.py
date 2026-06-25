"""SQLAlchemy ORM models for ConstructAI.

The schema is intentionally *industry-agnostic*: every Material and Vendor
belongs to an Industry, so the same platform can serve construction today and
electrical / plumbing / manufacturing tomorrow without code changes.
"""
from __future__ import annotations

import enum
from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    DateTime,
    Enum as SAEnum,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


# --------------------------------------------------------------------------- #
# Enums
# --------------------------------------------------------------------------- #
class Role(str, enum.Enum):
    STOCK_HANDLER = "stock_handler"
    MANAGER = "manager"
    VENDOR = "vendor"
    SITE_ENGINEER = "site_engineer"


class MovementType(str, enum.Enum):
    CONSUMPTION = "consumption"   # material used on site (negative quantity)
    DELIVERY = "delivery"         # material received from a vendor (positive)
    ADJUSTMENT = "adjustment"     # manual correction (+/-)
    INITIAL = "initial"           # opening stock when a material is created


class POStatus(str, enum.Enum):
    SUGGESTED = "suggested"   # proposed by the procurement engine, awaiting manager
    APPROVED = "approved"     # manager approved -> vendor notified
    REJECTED = "rejected"     # manager declined
    ORDERED = "ordered"       # vendor accepted / in transit
    DELIVERED = "delivered"   # received -> converted to a stock movement
    CANCELLED = "cancelled"


class RequestStatus(str, enum.Enum):
    PENDING = "pending"     # raised by a site engineer, awaiting the stock handler
    ISSUED = "issued"       # stock handler released the materials (stock drawn down)
    REJECTED = "rejected"   # stock handler declined


def _enum_col(enum_cls):
    """Store enums by their string *value* (e.g. 'manager') for readability."""
    return SAEnum(enum_cls, values_callable=lambda e: [m.value for m in e], native_enum=False)


# --------------------------------------------------------------------------- #
# Models
# --------------------------------------------------------------------------- #
class Industry(Base):
    __tablename__ = "industries"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(120), unique=True, nullable=False)
    slug: Mapped[str] = mapped_column(String(120), unique=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    sites: Mapped[list["Site"]] = relationship(back_populates="industry")
    users: Mapped[list["User"]] = relationship(back_populates="industry")


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(160), nullable=False)
    role: Mapped[Role] = mapped_column(_enum_col(Role), nullable=False)
    city: Mapped[str | None] = mapped_column(String(120), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    industry_id: Mapped[int | None] = mapped_column(ForeignKey("industries.id"), nullable=True)
    industry: Mapped["Industry | None"] = relationship(back_populates="users")

    # Only populated for users with the VENDOR role.
    vendor_profile: Mapped["Vendor | None"] = relationship(back_populates="user", uselist=False)


class Site(Base):
    """A physical project site/location. Each site runs its own stock & procurement,
    so a company can operate many sites (of possibly different industries) in parallel."""

    __tablename__ = "sites"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    code: Mapped[str | None] = mapped_column(String(40), nullable=True)
    city: Mapped[str | None] = mapped_column(String(120), nullable=True)  # drives the weather module
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    industry_id: Mapped[int] = mapped_column(ForeignKey("industries.id"), nullable=False, index=True)
    industry: Mapped["Industry"] = relationship(back_populates="sites")

    materials: Mapped[list["Material"]] = relationship(
        back_populates="site", cascade="all, delete-orphan"
    )


class Material(Base):
    __tablename__ = "materials"
    __table_args__ = (UniqueConstraint("site_id", "name", name="uq_material_per_site"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    unit: Mapped[str] = mapped_column(String(40), nullable=False)  # bags, tons, m3, pieces...
    current_stock: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    # When stock <= threshold the engine should reorder; target is the level to refill to.
    threshold: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    target_stock: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    # Materials like cement/sand degrade in rain -> the weather module buffers these.
    weather_sensitive: Mapped[bool] = mapped_column(Boolean, default=False)
    # Perishability: null = never expires. Each delivery becomes a batch that expires
    # `shelf_life_days` after it was received.
    shelf_life_days: Mapped[int | None] = mapped_column(Integer, nullable=True)
    # Untouchable safety stock, as a percent of target_stock (e.g. 15 => keep 15% in reserve).
    reserve_percent: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    site_id: Mapped[int] = mapped_column(ForeignKey("sites.id"), nullable=False, index=True)
    site: Mapped["Site"] = relationship(back_populates="materials")

    movements: Mapped[list["StockMovement"]] = relationship(
        back_populates="material", cascade="all, delete-orphan"
    )
    batches: Mapped[list["StockBatch"]] = relationship(
        back_populates="material", cascade="all, delete-orphan"
    )

    @property
    def reserved_quantity(self) -> float:
        """Untouchable safety stock (absolute units)."""
        if self.target_stock <= 0 or self.reserve_percent <= 0:
            return 0.0
        return round(self.reserve_percent / 100.0 * self.target_stock, 2)

    @property
    def available_stock(self) -> float:
        """Stock that may actually be used (current minus the reserve)."""
        return round(self.current_stock - self.reserved_quantity, 2)

    @property
    def below_reserve(self) -> bool:
        """True when stock has dipped into the safety reserve."""
        return self.current_stock < self.reserved_quantity

    @property
    def status(self) -> str:
        """Health of the *available* (non-reserved) stock vs. the reorder threshold."""
        if self.threshold <= 0:
            return "ok"
        available = self.available_stock
        if available <= 0.5 * self.threshold:
            return "critical"
        if available <= self.threshold:
            return "low"
        return "ok"


class StockMovement(Base):
    """Append-only ledger of every change to a material's stock (the 'actions')."""

    __tablename__ = "stock_movements"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    material_id: Mapped[int] = mapped_column(ForeignKey("materials.id"), nullable=False, index=True)
    quantity: Mapped[float] = mapped_column(Float, nullable=False)  # signed: + in, - out
    movement_type: Mapped[MovementType] = mapped_column(_enum_col(MovementType), nullable=False)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Snapshot of stock right after this movement (handy for charts & audits).
    balance_after: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, index=True)

    created_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)

    material: Mapped["Material"] = relationship(back_populates="movements")


class StockBatch(Base):
    """A received lot of a material, with its own expiry date.

    Stock-on-hand is the sum of batch `remaining_quantity`. Consumption draws down
    batches oldest-expiry-first (FIFO), which powers accurate expiry alerts.
    """

    __tablename__ = "stock_batches"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    material_id: Mapped[int] = mapped_column(ForeignKey("materials.id"), nullable=False, index=True)
    original_quantity: Mapped[float] = mapped_column(Float, nullable=False)
    remaining_quantity: Mapped[float] = mapped_column(Float, nullable=False)
    received_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, index=True)
    # Null for non-perishable materials.
    expiry_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True, index=True)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    material: Mapped["Material"] = relationship(back_populates="batches")


class Vendor(Base):
    __tablename__ = "vendors"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    city: Mapped[str | None] = mapped_column(String(120), nullable=True)
    rating: Mapped[float] = mapped_column(Float, default=3.0)  # 0..5, reliability score
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    user: Mapped["User | None"] = relationship(back_populates="vendor_profile")

    industry_id: Mapped[int | None] = mapped_column(ForeignKey("industries.id"), nullable=True)

    offers: Mapped[list["VendorOffer"]] = relationship(
        back_populates="vendor", cascade="all, delete-orphan"
    )


class VendorOffer(Base):
    """A vendor's current price + ETA for a material. The engine ranks these."""

    __tablename__ = "vendor_offers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    vendor_id: Mapped[int] = mapped_column(ForeignKey("vendors.id"), nullable=False, index=True)
    material_id: Mapped[int] = mapped_column(ForeignKey("materials.id"), nullable=False, index=True)
    price_per_unit: Mapped[float] = mapped_column(Float, nullable=False)
    eta_days: Mapped[int] = mapped_column(Integer, nullable=False)
    available_quantity: Mapped[float] = mapped_column(Float, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    vendor: Mapped["Vendor"] = relationship(back_populates="offers")
    material: Mapped["Material"] = relationship()


class PurchaseOrder(Base):
    """An order suggested by the engine and approved/rejected by a manager."""

    __tablename__ = "purchase_orders"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    material_id: Mapped[int] = mapped_column(ForeignKey("materials.id"), nullable=False, index=True)
    vendor_id: Mapped[int] = mapped_column(ForeignKey("vendors.id"), nullable=False, index=True)
    offer_id: Mapped[int | None] = mapped_column(ForeignKey("vendor_offers.id"), nullable=True)
    quantity: Mapped[float] = mapped_column(Float, nullable=False)
    price_per_unit: Mapped[float] = mapped_column(Float, nullable=False)
    total_price: Mapped[float] = mapped_column(Float, nullable=False)
    eta_days: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[POStatus] = mapped_column(_enum_col(POStatus), default=POStatus.SUGGESTED, index=True)
    # Why the engine proposed this (urgency, weather buffer, cheapest, fastest...).
    rationale: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    decided_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)

    material: Mapped["Material"] = relationship()
    vendor: Mapped["Vendor"] = relationship()


class WeatherRecord(Base):
    """City weather snapshots/forecasts used to nudge procurement suggestions."""

    __tablename__ = "weather_records"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    city: Mapped[str] = mapped_column(String(120), nullable=False, index=True)
    date: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    condition: Mapped[str] = mapped_column(String(60), nullable=False)  # clear, rain, storm...
    temp_c: Mapped[float | None] = mapped_column(Float, nullable=True)
    is_forecast: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)


class DailyUpdate(Base):
    """A site engineer's daily progress report, visible to the manager."""

    __tablename__ = "daily_updates"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    site_id: Mapped[int] = mapped_column(ForeignKey("sites.id"), nullable=False, index=True)
    author_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    progress_percent: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)  # 0..100
    summary: Mapped[str] = mapped_column(Text, nullable=False)        # what was done today
    labor_count: Mapped[int] = mapped_column(Integer, default=0)      # workers on site
    issues: Mapped[str | None] = mapped_column(Text, nullable=True)   # blockers / open issues
    weather_impact: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, index=True)

    site: Mapped["Site"] = relationship()
    author: Mapped["User | None"] = relationship()


class MaterialRequest(Base):
    """Materials a site engineer asks the stock handler to issue for the day's work."""

    __tablename__ = "material_requests"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    site_id: Mapped[int] = mapped_column(ForeignKey("sites.id"), nullable=False, index=True)
    requested_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    status: Mapped[RequestStatus] = mapped_column(
        _enum_col(RequestStatus), default=RequestStatus.PENDING, index=True
    )
    needed_for: Mapped[str | None] = mapped_column(String(160), nullable=True)  # e.g. "Block B slab"
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, index=True)
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    decided_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)

    site: Mapped["Site"] = relationship()
    items: Mapped[list["MaterialRequestItem"]] = relationship(
        back_populates="request", cascade="all, delete-orphan"
    )


class MaterialRequestItem(Base):
    __tablename__ = "material_request_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    request_id: Mapped[int] = mapped_column(ForeignKey("material_requests.id"), nullable=False, index=True)
    material_id: Mapped[int] = mapped_column(ForeignKey("materials.id"), nullable=False)
    quantity: Mapped[float] = mapped_column(Float, nullable=False)

    request: Mapped["MaterialRequest"] = relationship(back_populates="items")
    material: Mapped["Material"] = relationship()


class Budget(Base):
    """A site's project budget. The AI proposes it (materials + labour +
    contingency, connecting weather/procurement/labour); the manager can adjust.
    Actual spend is derived from purchase orders + labour, never stored here."""

    __tablename__ = "budgets"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    site_id: Mapped[int] = mapped_column(
        ForeignKey("sites.id"), unique=True, nullable=False, index=True
    )
    total_amount: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    materials_amount: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    labour_amount: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    contingency_amount: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    # Labour cost per worker-day used to turn daily-update headcounts into ₹.
    labor_rate: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    source: Mapped[str] = mapped_column(String(20), default="ai", nullable=False)  # ai | manual
    rationale: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, onupdate=_utcnow
    )

    site: Mapped["Site"] = relationship()


class SiteImageReport(Base):
    """An AI vision analysis of a site progress photo a site engineer uploads.
    The image is stored base64 in Postgres (Render's disk is ephemeral). The
    list fields are stored as JSON text."""

    __tablename__ = "site_image_reports"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    site_id: Mapped[int] = mapped_column(ForeignKey("sites.id"), nullable=False, index=True)
    author_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    media_type: Mapped[str] = mapped_column(String(60), default="image/jpeg", nullable=False)
    image_b64: Mapped[str] = mapped_column(Text, nullable=False)
    caption: Mapped[str | None] = mapped_column(String(200), nullable=True)
    # AI vision output:
    progress_estimate: Mapped[float | None] = mapped_column(Float, nullable=True)  # 0..100
    summary: Mapped[str] = mapped_column(Text, nullable=False, default="")
    observations: Mapped[str] = mapped_column(Text, nullable=False, default="[]")      # JSON list
    safety_flags: Mapped[str] = mapped_column(Text, nullable=False, default="[]")      # JSON list
    materials_visible: Mapped[str] = mapped_column(Text, nullable=False, default="[]")  # JSON list
    status: Mapped[str] = mapped_column(String(30), default="pending", nullable=False)
    used_ai: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, index=True)

    site: Mapped["Site"] = relationship()
    author: Mapped["User | None"] = relationship()
