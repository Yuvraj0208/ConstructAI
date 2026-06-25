"""Tests for the AI layer (status, NL insights, AI budgeting) on the rule-based
fallback path — so they run with no Claude key."""
from __future__ import annotations


def login(client, email, password="password123"):
    res = client.post("/auth/login", json={"email": email, "password": password})
    assert res.status_code == 200, res.text
    return {"Authorization": f"Bearer {res.json()['access_token']}"}


def test_ai_status_disabled_without_key(client):
    res = client.get("/ai/status")
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["enabled"] is False  # no key in tests
    assert body["model"]


def test_ask_recommends_ordering_grounded_in_data(client, seed_data):
    mgr = login(client, "manager@test.dev")
    res = client.post(
        "/ai/ask",
        json={"site_id": seed_data["site_id"], "question": "What should I order?"},
        headers=mgr,
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["used_ai"] is False
    assert "Cement" in body["answer"]  # the seeded low material
    assert any(s["label"] == "Vendor offers" for s in body["sources"])


def test_ask_requires_manager_role(client, seed_data):
    stock = login(client, "stock@test.dev")
    res = client.post(
        "/ai/ask",
        json={"site_id": seed_data["site_id"], "question": "hi"},
        headers=stock,
    )
    assert res.status_code == 403, res.text


def test_budget_autoproposes_and_forecasts(client, seed_data):
    mgr = login(client, "manager@test.dev")
    res = client.get("/ai/budget", params={"site_id": seed_data["site_id"]}, headers=mgr)
    assert res.status_code == 200, res.text
    body = res.json()
    b = body["budget"]
    assert b["total_amount"] > 0
    assert b["source"] == "ai"
    # Total should equal the sum of the category amounts (within rounding).
    parts = b["materials_amount"] + b["labour_amount"] + b["contingency_amount"]
    assert abs(parts - b["total_amount"]) < 1.0
    assert body["used_ai"] is False
    assert body["insight"]


def test_manager_can_adjust_budget(client, seed_data):
    mgr = login(client, "manager@test.dev")
    created = client.get("/ai/budget", params={"site_id": seed_data["site_id"]}, headers=mgr).json()
    budget_id = created["budget"]["id"]
    res = client.patch(f"/ai/budget/{budget_id}", json={"total_amount": 1234567}, headers=mgr)
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["budget"]["total_amount"] == 1234567
    assert body["budget"]["source"] == "manual"


def test_budget_requires_manager_role(client, seed_data):
    stock = login(client, "stock@test.dev")
    res = client.get("/ai/budget", params={"site_id": seed_data["site_id"]}, headers=stock)
    assert res.status_code == 403, res.text
