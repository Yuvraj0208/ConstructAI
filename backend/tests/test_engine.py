"""Unit tests for the procurement engine's pure scoring/allocation logic."""
from __future__ import annotations

from types import SimpleNamespace

from app.services.procurement import compute_urgency, plan_material, score_offers


def make_offer(price, eta, qty, *, rating=3.0, vid=1, oid=1, active=True):
    return SimpleNamespace(
        price_per_unit=price, eta_days=eta, available_quantity=qty, is_active=active,
        vendor_id=vid, id=oid, vendor=SimpleNamespace(rating=rating, name=f"V{vid}"),
    )


def make_material(current, threshold, target, unit="bags", name="Cement"):
    return SimpleNamespace(
        current_stock=current, threshold=threshold, target_stock=target, unit=unit, name=name
    )


def test_urgency_is_monotonic_and_clamped():
    assert compute_urgency(100, 100) == 0.0
    assert compute_urgency(0, 100) == 1.0
    assert compute_urgency(50, 100) == 0.5
    assert compute_urgency(120, 100) == 0.0  # above threshold -> clamped to 0


def test_score_prefers_cheaper_when_relaxed():
    cheap_slow = make_offer(100, 5, 100, oid=1, vid=1)
    pricey_fast = make_offer(200, 1, 100, oid=2, vid=2)
    scored = score_offers([cheap_slow, pricey_fast], urgency=0.0)
    assert scored[0].offer.id == 1  # not urgent -> price dominates


def test_score_prefers_faster_when_urgent():
    cheap_slow = make_offer(100, 5, 100, oid=1, vid=1)
    pricey_fast = make_offer(200, 1, 100, oid=2, vid=2)
    scored = score_offers([cheap_slow, pricey_fast], urgency=1.0)
    assert scored[0].offer.id == 2  # urgent -> speed dominates (pays more for ETA)


def test_allocation_splits_across_vendors_to_cover_deficit():
    material = make_material(current=0, threshold=10, target=100)  # need 100
    o1 = make_offer(100, 1, 60, oid=1, vid=1)
    o2 = make_offer(110, 2, 80, oid=2, vid=2)
    plans = plan_material(material, [o1, o2], rain_buffer=False)
    assert sum(p.quantity for p in plans) == 100  # deficit fully covered
    assert len(plans) == 2  # had to split since no single vendor had enough


def test_rain_buffer_increases_order_quantity():
    material = make_material(current=80, threshold=100, target=500)
    offer = make_offer(100, 1, 1000, oid=1, vid=1)
    without = plan_material(material, [offer], rain_buffer=False)
    with_rain = plan_material(material, [offer], rain_buffer=True)
    assert without[0].quantity == 420  # 500 - 80
    assert with_rain[0].quantity == 504  # 420 * 1.20


def test_no_offers_yields_no_plan():
    material = make_material(current=5, threshold=100, target=500)
    assert plan_material(material, [], rain_buffer=False) == []
