"""Shared pytest fixtures: an isolated in-memory DB, a TestClient, and seed data."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.main import app
from app.models import Industry, Material, Role, Site, StockBatch, User, Vendor, VendorOffer
from app.security import hash_password

# A weather forecast stub so tests never hit the network (and are deterministic).
FIXED_WEATHER = {
    "city": "Testville",
    "source": "simulated",
    "condition": "Rain",
    "temp_c": 25.0,
    "precipitation_mm": 10.0,
    "will_rain": True,
    "days": [
        {"date": "2026-06-06", "condition": "Rain", "precipitation_mm": 10.0, "temp_max_c": 25.0, "rain": True}
    ],
}


@pytest.fixture()
def db_session():
    # In-memory SQLite shared across the connection pool via StaticPool.
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    Base.metadata.create_all(bind=engine)
    TestingSessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)
        engine.dispose()


@pytest.fixture()
def client(db_session, monkeypatch):
    # Stub weather everywhere it's used.
    monkeypatch.setattr("app.services.weather.get_forecast", lambda *a, **k: FIXED_WEATHER)
    monkeypatch.setattr("app.services.procurement.get_forecast", lambda *a, **k: FIXED_WEATHER)
    monkeypatch.setattr("app.routers.weather.get_forecast", lambda *a, **k: FIXED_WEATHER)

    def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    # No `with` block -> skip lifespan so the real SQLite file is never touched.
    yield TestClient(app)
    app.dependency_overrides.clear()


@pytest.fixture()
def seed_data(db_session):
    """Minimal dataset: 1 industry, 3 users, 2 vendors, a low+rain-sensitive material."""
    industry = Industry(name="Construction", slug="construction")
    db_session.add(industry)
    db_session.flush()

    site = Site(name="Test Site", code="TS", city="Testville", industry_id=industry.id)
    db_session.add(site)
    db_session.flush()

    def make_user(email, role, city=None):
        u = User(
            email=email,
            hashed_password=hash_password("password123"),
            full_name=email.split("@")[0],
            role=role,
            city=city,
            industry_id=industry.id,
        )
        db_session.add(u)
        db_session.flush()
        return u

    manager = make_user("manager@test.dev", Role.MANAGER, city="Testville")
    make_user("stock@test.dev", Role.STOCK_HANDLER)
    make_user("engineer@test.dev", Role.SITE_ENGINEER)
    vendor_user = make_user("vendor@test.dev", Role.VENDOR)

    vendor1 = Vendor(name="FastCheapCo", rating=4.0, user_id=vendor_user.id, industry_id=industry.id)
    vendor2 = Vendor(name="OtherCo", rating=3.5, industry_id=industry.id)
    db_session.add_all([vendor1, vendor2])
    db_session.flush()

    cement = Material(
        name="Cement", unit="bags", current_stock=80, threshold=100, target_stock=500,
        weather_sensitive=True, shelf_life_days=90, reserve_percent=0, site_id=site.id,
    )
    db_session.add(cement)
    db_session.flush()

    # Stock-on-hand = two batches (one expiring soon) summing to 80.
    now = datetime.now(timezone.utc)
    db_session.add_all([
        StockBatch(material_id=cement.id, original_quantity=70, remaining_quantity=70,
                   received_at=now, expiry_date=now + timedelta(days=80), note="fresh"),
        StockBatch(material_id=cement.id, original_quantity=10, remaining_quantity=10,
                   received_at=now - timedelta(days=86), expiry_date=now + timedelta(days=4), note="expiring"),
    ])

    # vendor1 is cheaper AND faster -> engine should pick it and it has enough qty.
    db_session.add_all([
        VendorOffer(vendor_id=vendor1.id, material_id=cement.id, price_per_unit=380, eta_days=2, available_quantity=600),
        VendorOffer(vendor_id=vendor2.id, material_id=cement.id, price_per_unit=410, eta_days=3, available_quantity=300),
    ])
    db_session.commit()

    return {
        "industry_id": industry.id,
        "site_id": site.id,
        "manager_id": manager.id,
        "vendor1_id": vendor1.id,
        "vendor2_id": vendor2.id,
        "cement_id": cement.id,
    }
