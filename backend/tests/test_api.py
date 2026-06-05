"""Integration tests for the API: auth, role guards, stock, and procurement lifecycle."""
from __future__ import annotations


def login(client, email, password="password123"):
    res = client.post("/auth/login", json={"email": email, "password": password})
    assert res.status_code == 200, res.text
    return {"Authorization": f"Bearer {res.json()['access_token']}"}


def test_signup_then_login_and_me(client):
    res = client.post(
        "/auth/signup",
        json={"email": "newmgr@test.dev", "password": "secret123", "full_name": "New Mgr", "role": "manager"},
    )
    assert res.status_code == 201, res.text
    token = res.json()["access_token"]
    me = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200
    assert me.json()["email"] == "newmgr@test.dev"
    assert me.json()["role"] == "manager"


def test_duplicate_email_rejected(client, seed_data):
    res = client.post(
        "/auth/signup",
        json={"email": "manager@test.dev", "password": "secret123", "full_name": "Dup", "role": "manager"},
    )
    assert res.status_code == 409


def test_protected_endpoint_requires_auth(client):
    assert client.get("/materials").status_code == 401


def test_stock_handler_cannot_create_material(client, seed_data):
    headers = login(client, "stock@test.dev")
    res = client.post(
        "/materials",
        json={"name": "X", "unit": "u", "industry_id": seed_data["industry_id"]},
        headers=headers,
    )
    assert res.status_code == 403


def test_recording_consumption_reduces_stock(client, seed_data):
    headers = login(client, "stock@test.dev")
    res = client.post(
        "/stock/movements",
        json={"material_id": seed_data["cement_id"], "movement_type": "consumption", "quantity": 30},
        headers=headers,
    )
    assert res.status_code == 201, res.text
    assert res.json()["balance_after"] == 50  # 80 - 30
    assert res.json()["quantity"] == -30  # consumption stored as negative


def test_weather_advisory_lists_sensitive_materials(client, seed_data):
    headers = login(client, "manager@test.dev")
    res = client.get("/weather", headers=headers)
    assert res.status_code == 200
    body = res.json()
    assert body["will_rain"] is True
    assert "Cement" in body["advisory"]


def test_full_procurement_lifecycle(client, seed_data):
    manager = login(client, "manager@test.dev")

    # 1. Run the engine -> suggestions exist, with the rain buffer applied.
    run = client.post("/procurement/run", headers=manager)
    assert run.status_code == 200, run.text
    suggestions = run.json()["suggestions"]
    assert len(suggestions) >= 1
    po = next(s for s in suggestions if s["vendor_id"] == seed_data["vendor1_id"])
    assert po["quantity"] == 504  # (500 - 80) * 1.20 rain buffer
    assert po["status"] == "suggested"

    # 2. Manager approves.
    approve = client.post(f"/procurement/orders/{po['id']}/approve", headers=manager)
    assert approve.status_code == 200
    assert approve.json()["status"] == "approved"

    # 3. Vendor accepts -> ordered.
    vendor = login(client, "vendor@test.dev")
    accept = client.post(f"/procurement/orders/{po['id']}/accept", headers=vendor)
    assert accept.status_code == 200
    assert accept.json()["status"] == "ordered"

    # 4. Stock handler receives -> delivered, and stock goes up by the order qty.
    stock = login(client, "stock@test.dev")
    before = next(m for m in client.get("/materials", headers=stock).json() if m["id"] == seed_data["cement_id"])
    receive = client.post(f"/procurement/orders/{po['id']}/receive", headers=stock)
    assert receive.status_code == 200
    assert receive.json()["status"] == "delivered"
    after = next(m for m in client.get("/materials", headers=stock).json() if m["id"] == seed_data["cement_id"])
    assert after["current_stock"] == before["current_stock"] + po["quantity"]


def test_vendor_cannot_approve_orders(client, seed_data):
    manager = login(client, "manager@test.dev")
    run = client.post("/procurement/run", headers=manager)
    po = run.json()["suggestions"][0]
    vendor = login(client, "vendor@test.dev")
    res = client.post(f"/procurement/orders/{po['id']}/approve", headers=vendor)
    assert res.status_code == 403
