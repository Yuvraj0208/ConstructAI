"""Seed the database with demo data.

    python -m app.seed           # seed only if empty
    python -m app.seed --reset   # wipe everything and reseed

Creates one user per role, a construction + electrical industry, materials with
thresholds, competing vendor offers (price vs. ETA tradeoffs), and ~2 weeks of
stock history (including a deliberate cement-usage spike to demo anomaly alerts).
"""
from __future__ import annotations

import random
import sys
from datetime import datetime, timedelta, timezone

from sqlalchemy import select

from .database import Base, SessionLocal
from .models import (
    DailyUpdate,
    Industry,
    Material,
    MaterialRequest,
    MaterialRequestItem,
    MovementType,
    Role,
    Site,
    StockBatch,
    StockMovement,
    User,
    Vendor,
    VendorOffer,
)
from .security import hash_password

DEMO_PASSWORD = "password123"
_rng = random.Random(42)


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _build_material_with_history(
    db,
    *,
    site_id: int,
    name: str,
    unit: str,
    threshold: float,
    target: float,
    weather_sensitive: bool,
    desired_final: float,
    avg_daily: float,
    deliveries: list[tuple[int, float]],
    anomaly: tuple[int, float] | None = None,
    creator_id: int,
    reserve_percent: float = 0.0,
    shelf_life_days: int | None = None,
    batches: list[tuple[int, float]] | None = None,
) -> Material:
    """Create a material plus a realistic 14-day movement ledger.

    Opening stock is back-computed so the simulated final balance lands exactly
    on `desired_final` (no awkward end-of-ledger correction needed).
    """
    events: list[tuple[int, MovementType, float]] = []
    total_consumed = 0.0
    for days_ago in range(14, 0, -1):
        amount = max(0.0, round(_rng.gauss(avg_daily, avg_daily * 0.25), 1))
        if anomaly and days_ago == anomaly[0]:
            amount = anomaly[1]  # the spike (e.g. possible theft)
        events.append((days_ago, MovementType.CONSUMPTION, amount))
        total_consumed += amount

    total_delivered = 0.0
    for days_ago, amount in deliveries:
        events.append((days_ago, MovementType.DELIVERY, amount))
        total_delivered += amount

    opening = desired_final + total_consumed - total_delivered
    if opening < 0:
        raise ValueError(f"{name}: negative opening stock ({opening}); adjust seed numbers")

    material = Material(
        name=name,
        unit=unit,
        threshold=threshold,
        target_stock=target,
        weather_sensitive=weather_sensitive,
        shelf_life_days=shelf_life_days,
        reserve_percent=reserve_percent,
        site_id=site_id,
        current_stock=opening,
    )
    db.add(material)
    db.flush()

    # Opening stock, 15 days ago.
    balance = opening
    db.add(
        StockMovement(
            material_id=material.id,
            quantity=opening,
            movement_type=MovementType.INITIAL,
            note="Opening stock",
            balance_after=balance,
            created_by_id=creator_id,
            created_at=_now() - timedelta(days=15),
        )
    )

    # Apply events oldest-first so balances are chronologically correct.
    for days_ago, mtype, amount in sorted(events, key=lambda e: -e[0]):
        signed = amount if mtype == MovementType.DELIVERY else -amount
        balance += signed
        db.add(
            StockMovement(
                material_id=material.id,
                quantity=signed,
                movement_type=mtype,
                note="Auto-seeded delivery" if mtype == MovementType.DELIVERY else None,
                balance_after=balance,
                created_by_id=creator_id,
                created_at=_now() - timedelta(days=days_ago, hours=_rng.randint(0, 8)),
            )
        )

    material.current_stock = balance

    # Current on-hand stock, modelled as batches (so expiry/FIFO is realistic).
    # Default: one fresh batch holding all of it. Perishables pass explicit batches
    # (with varied ages) to demo expired / expiring-soon / fresh lots.
    batch_specs = batches if batches is not None else [(4, desired_final)]
    on_hand = 0.0
    for days_ago, qty in batch_specs:
        received = _now() - timedelta(days=days_ago)
        expiry = received + timedelta(days=shelf_life_days) if shelf_life_days else None
        db.add(
            StockBatch(
                material_id=material.id,
                original_quantity=qty,
                remaining_quantity=qty,
                received_at=received,
                expiry_date=expiry,
                note="Opening lot",
            )
        )
        on_hand += qty
    material.current_stock = round(on_hand, 2)
    return material


def _create_user(db, *, email, full_name, role, city, industry_id) -> User:
    user = User(
        email=email,
        hashed_password=hash_password(DEMO_PASSWORD),
        full_name=full_name,
        role=role,
        city=city,
        industry_id=industry_id,
    )
    db.add(user)
    db.flush()
    return user


def _schema_ready(db) -> bool:
    """True if the tables exist (i.e. `alembic upgrade head` has been run)."""
    try:
        db.execute(select(Industry).limit(1))
        return True
    except Exception:
        db.rollback()
        return False


def _wipe_data(db) -> None:
    """Delete all rows (FK-safe order). Schema is left intact — Alembic owns it."""
    print("Clearing existing data...")
    for table in reversed(Base.metadata.sorted_tables):
        db.execute(table.delete())
    db.commit()


def seed(reset: bool = False) -> None:
    db = SessionLocal()
    try:
        if not _schema_ready(db):
            print("Schema not found. Create it first with:  alembic upgrade head")
            return
        if reset:
            _wipe_data(db)
        if db.scalar(select(Industry)) is not None:
            print("Database already seeded. Use --reset to wipe and reseed.")
            return

        # --- Industries -------------------------------------------------- #
        construction = Industry(name="Construction", slug="construction")
        electrical = Industry(name="Electrical", slug="electrical")
        db.add_all([construction, electrical])
        db.flush()

        # --- Users ------------------------------------------------------- #
        manager = _create_user(
            db, email="manager@constructai.dev", full_name="Priya Manager",
            role=Role.MANAGER, city="Mumbai", industry_id=construction.id,
        )
        handler = _create_user(
            db, email="stock@constructai.dev", full_name="Ravi Stock-Handler",
            role=Role.STOCK_HANDLER, city="Mumbai", industry_id=construction.id,
        )
        engineer = _create_user(
            db, email="engineer@constructai.dev", full_name="Aarti Site-Engineer",
            role=Role.SITE_ENGINEER, city="Mumbai", industry_id=construction.id,
        )

        # --- Vendors (each also a login) --------------------------------- #
        vendor_specs = [
            ("vendor1@constructai.dev", "Anil Sharma", "UltraTech Supplies", "Mumbai", 4.5),
            ("vendor2@constructai.dev", "Meena Rao", "Coastal Aggregates", "Pune", 4.0),
            ("vendor3@constructai.dev", "Sunil Gupta", "RapidBuild Traders", "Mumbai", 3.5),
        ]
        vendors: dict[str, Vendor] = {}
        for email, person, company, city, rating in vendor_specs:
            vuser = _create_user(
                db, email=email, full_name=person, role=Role.VENDOR,
                city=city, industry_id=construction.id,
            )
            vendor = Vendor(
                name=company, city=city, rating=rating,
                user_id=vuser.id, industry_id=construction.id,
            )
            db.add(vendor)
            db.flush()
            vendors[company] = vendor

        # --- Sites (a company runs several; switch between them in the UI) - #
        skyline = Site(name="Skyline Residency", code="SKY", city="Mumbai", industry_id=construction.id)
        harbor = Site(name="Harbor Bridge", code="HBR", city="Pune", industry_id=construction.id)
        techpark = Site(name="TechPark Wiring", code="TPK", city="Bangalore", industry_id=electrical.id)
        db.add_all([skyline, harbor, techpark])
        db.flush()

        # --- Skyline Residency (construction) materials + history -------- #
        cement = _build_material_with_history(
            db, site_id=skyline.id, name="Cement", unit="bags",
            threshold=100, target=500, weather_sensitive=True,
            desired_final=150, avg_daily=30, deliveries=[(10, 200), (4, 150)],
            anomaly=(5, 130), creator_id=handler.id,
            reserve_percent=15, shelf_life_days=90,
            # Varied ages: 10 already expired, 30 expiring in ~2 days, then fresher lots.
            batches=[(95, 10), (88, 30), (50, 50), (3, 60)],
        )
        sand = _build_material_with_history(
            db, site_id=skyline.id, name="Sand", unit="tons",
            threshold=20, target=100, weather_sensitive=True,
            desired_final=25, avg_daily=6, deliveries=[(10, 40), (4, 30)],
            creator_id=handler.id, reserve_percent=10,
        )
        bricks = _build_material_with_history(
            db, site_id=skyline.id, name="Bricks", unit="pieces",
            threshold=5000, target=20000, weather_sensitive=False,
            desired_final=9000, avg_daily=600, deliveries=[(10, 8000), (4, 6000)],
            creator_id=handler.id, reserve_percent=5,
        )
        steel = _build_material_with_history(
            db, site_id=skyline.id, name="Steel Rods", unit="tons",
            threshold=10, target=50, weather_sensitive=False,
            desired_final=6, avg_daily=2, deliveries=[(10, 12), (4, 10)],
            creator_id=handler.id, reserve_percent=10,
        )
        gravel = _build_material_with_history(
            db, site_id=skyline.id, name="Gravel", unit="tons",
            threshold=15, target=60, weather_sensitive=True,
            desired_final=45, avg_daily=4, deliveries=[(10, 30), (4, 20)],
            creator_id=handler.id, reserve_percent=10,
        )

        # --- Harbor Bridge (construction) — different stock levels ------- #
        h_cement = _build_material_with_history(
            db, site_id=harbor.id, name="Cement", unit="bags",
            threshold=120, target=600, weather_sensitive=True,
            desired_final=420, avg_daily=25, deliveries=[(9, 250), (3, 200)],
            creator_id=handler.id, reserve_percent=15, shelf_life_days=90,
            batches=[(60, 120), (5, 300)],
        )
        h_steel = _build_material_with_history(
            db, site_id=harbor.id, name="Steel Rods", unit="tons",
            threshold=12, target=60, weather_sensitive=False,
            desired_final=8, avg_daily=3, deliveries=[(9, 18), (3, 12)],
            creator_id=handler.id, reserve_percent=10,
        )
        h_gravel = _build_material_with_history(
            db, site_id=harbor.id, name="Gravel", unit="tons",
            threshold=20, target=80, weather_sensitive=True,
            desired_final=70, avg_daily=5, deliveries=[(9, 40), (3, 25)],
            creator_id=handler.id, reserve_percent=10,
        )

        # --- TechPark (electrical) materials ----------------------------- #
        for name, unit, threshold, target, current, reserve in [
            ("Copper Wire", "meters", 500, 2000, 1500, 10),
            ("PVC Conduit", "pieces", 300, 1500, 250, 10),
        ]:
            m = Material(
                name=name, unit=unit, threshold=threshold, target_stock=target,
                weather_sensitive=False, reserve_percent=reserve,
                site_id=techpark.id, current_stock=current,
            )
            db.add(m)
            db.flush()
            db.add(StockBatch(
                material_id=m.id, original_quantity=current, remaining_quantity=current,
                received_at=_now() - timedelta(days=10), expiry_date=None, note="Opening lot",
            ))
            db.add(StockMovement(
                material_id=m.id, quantity=current, movement_type=MovementType.INITIAL,
                note="Opening stock", balance_after=current, created_by_id=manager.id,
                created_at=_now() - timedelta(days=15),
            ))

        # --- Vendor offers (price vs. ETA tradeoffs the engine will rank) - #
        offers = [
            # Cement: UltraTech cheaper/slower, RapidBuild pricier/faster.
            (vendors["UltraTech Supplies"], cement, 380, 2, 600),
            (vendors["RapidBuild Traders"], cement, 410, 1, 300),
            # Sand
            (vendors["Coastal Aggregates"], sand, 1200, 3, 200),
            (vendors["RapidBuild Traders"], sand, 1400, 1, 80),
            # Bricks
            (vendors["UltraTech Supplies"], bricks, 8, 4, 30000),
            # Steel Rods
            (vendors["UltraTech Supplies"], steel, 55000, 5, 60),
            (vendors["RapidBuild Traders"], steel, 60000, 2, 30),
            # Gravel
            (vendors["Coastal Aggregates"], gravel, 900, 3, 150),
            # --- Harbor Bridge site offers ---
            (vendors["UltraTech Supplies"], h_cement, 385, 2, 700),
            (vendors["RapidBuild Traders"], h_cement, 415, 1, 350),
            (vendors["UltraTech Supplies"], h_steel, 56000, 4, 70),
            (vendors["RapidBuild Traders"], h_steel, 61000, 2, 35),
            (vendors["Coastal Aggregates"], h_gravel, 920, 3, 160),
        ]
        for vendor, material, price, eta, qty in offers:
            db.add(VendorOffer(
                vendor_id=vendor.id, material_id=material.id,
                price_per_unit=price, eta_days=eta, available_quantity=qty,
            ))

        # --- Site engineer activity at Skyline --------------------------- #
        db.add_all([
            DailyUpdate(
                site_id=skyline.id, author_id=engineer.id, progress_percent=42,
                summary="Completed 2nd-floor slab shuttering; column casting underway.",
                labor_count=38, issues="Steel rods running low — may delay column work.",
                weather_impact="Light rain forecast; covered the cement store.",
                created_at=_now() - timedelta(days=1, hours=3),
            ),
            DailyUpdate(
                site_id=skyline.id, author_id=engineer.id, progress_percent=45,
                summary="Block A column casting complete; curing started.",
                labor_count=41, issues=None, weather_impact="Clear day, good progress.",
                created_at=_now() - timedelta(hours=4),
            ),
        ])
        request = MaterialRequest(
            site_id=skyline.id, requested_by_id=engineer.id,
            needed_for="Block A column casting", note="Required for today's pour.",
        )
        db.add(request)
        db.flush()
        db.add_all([
            MaterialRequestItem(request_id=request.id, material_id=cement.id, quantity=40),
            MaterialRequestItem(request_id=request.id, material_id=steel.id, quantity=2),
        ])

        db.commit()
        print("Seed complete.\n")
        print("Sites: Skyline Residency + Harbor Bridge (construction) · TechPark Wiring (electrical)")
        print("Demo accounts (password: %s):" % DEMO_PASSWORD)
        print("  Manager       : manager@constructai.dev")
        print("  Stock handler : stock@constructai.dev")
        print("  Site engineer : engineer@constructai.dev")
        print("  Vendor        : vendor1@constructai.dev (UltraTech Supplies)")
        print("                  vendor2@constructai.dev (Coastal Aggregates)")
        print("                  vendor3@constructai.dev (RapidBuild Traders)")
    finally:
        db.close()


if __name__ == "__main__":
    seed(reset="--reset" in sys.argv)
