"""Tests for reserve stock, batch FIFO consumption, and expiry classification."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from sqlalchemy import select

from app.models import Industry, Material, Site, StockBatch
from app.services.inventory import consume_fifo, expiry_status, recompute_stock


# --- Reserve (untouchable safety stock) ------------------------------------- #
def test_reserve_reduces_available_and_drives_status():
    m = Material(name="C", unit="bags", current_stock=120, threshold=100, target_stock=500, reserve_percent=20)
    assert m.reserved_quantity == 100  # 20% of 500
    assert m.available_stock == 20     # 120 - 100
    assert m.below_reserve is False
    assert m.status == "critical"      # available 20 <= 0.5 * threshold


def test_below_reserve_flag_when_stock_under_reserve():
    m = Material(name="C", unit="bags", current_stock=80, threshold=100, target_stock=500, reserve_percent=20)
    assert m.available_stock == -20
    assert m.below_reserve is True


def test_zero_reserve_is_backwards_compatible():
    m = Material(name="C", unit="bags", current_stock=200, threshold=100, target_stock=500, reserve_percent=0)
    assert m.reserved_quantity == 0
    assert m.available_stock == 200
    assert m.status == "ok"


# --- Expiry classification -------------------------------------------------- #
def test_expiry_status_buckets():
    now = datetime(2026, 6, 6, tzinfo=timezone.utc)
    assert expiry_status(None, now=now) == "fresh"            # non-perishable
    assert expiry_status(now - timedelta(days=1), now=now) == "expired"
    assert expiry_status(now + timedelta(days=3), now=now) == "expiring"
    assert expiry_status(now + timedelta(days=60), now=now) == "fresh"


# --- FIFO consumption ------------------------------------------------------- #
def test_consume_fifo_draws_soonest_expiry_first(db_session):
    industry = Industry(name="I", slug="i")
    db_session.add(industry)
    db_session.flush()
    site = Site(name="S", industry_id=industry.id)
    db_session.add(site)
    db_session.flush()
    material = Material(
        name="Cement", unit="bags", current_stock=0, threshold=10, target_stock=100,
        shelf_life_days=30, site_id=site.id,
    )
    db_session.add(material)
    db_session.flush()

    now = datetime.now(timezone.utc)
    db_session.add_all([
        StockBatch(material_id=material.id, original_quantity=20, remaining_quantity=20,
                   received_at=now - timedelta(days=20), expiry_date=now + timedelta(days=5), note="A"),
        StockBatch(material_id=material.id, original_quantity=30, remaining_quantity=30,
                   received_at=now - timedelta(days=5), expiry_date=now + timedelta(days=25), note="B"),
    ])
    db_session.flush()

    consumed = consume_fifo(db_session, material, 25)
    assert consumed == 25
    assert recompute_stock(db_session, material) == 25  # 50 - 25

    remaining = {b.note: b.remaining_quantity for b in db_session.scalars(select(StockBatch)).all()}
    assert remaining["A"] == 0    # earliest-expiry batch drained first
    assert remaining["B"] == 25   # then 5 taken from the later batch
