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
        json={"name": "X", "unit": "u", "site_id": seed_data["site_id"]},
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
    res = client.get("/weather", params={"site_id": seed_data["site_id"]}, headers=headers)
    assert res.status_code == 200
    body = res.json()
    assert body["will_rain"] is True
    assert "Cement" in body["advisory"]


def test_full_procurement_lifecycle(client, seed_data):
    manager = login(client, "manager@test.dev")

    # 1. Run the engine -> suggestions exist, with the rain buffer applied.
    run = client.post("/procurement/run", params={"site_id": seed_data["site_id"]}, headers=manager)
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
    run = client.post("/procurement/run", params={"site_id": seed_data["site_id"]}, headers=manager)
    po = run.json()["suggestions"][0]
    vendor = login(client, "vendor@test.dev")
    res = client.post(f"/procurement/orders/{po['id']}/approve", headers=vendor)
    assert res.status_code == 403


def test_material_out_exposes_reserve_and_available(client, seed_data):
    headers = login(client, "stock@test.dev")
    materials = client.get("/materials", headers=headers).json()
    cement = next(m for m in materials if m["name"] == "Cement")
    assert {"reserved_quantity", "available_stock", "below_reserve"} <= cement.keys()
    assert cement["available_stock"] == cement["current_stock"] - cement["reserved_quantity"]


def test_expiry_endpoint_lists_expiring_batches(client, seed_data):
    headers = login(client, "manager@test.dev")
    res = client.get("/stock/expiry", headers=headers)
    assert res.status_code == 200
    items = res.json()
    # The seeded Cement has a batch expiring in ~4 days.
    assert any(i["material_name"] == "Cement" and i["expiry_status"] == "expiring" for i in items)


def test_sites_listed_and_materials_scoped_by_site(client, seed_data):
    headers = login(client, "manager@test.dev")

    sites = client.get("/sites", headers=headers)
    assert sites.status_code == 200
    assert seed_data["site_id"] in [s["id"] for s in sites.json()]

    mats = client.get("/materials", params={"site_id": seed_data["site_id"]}, headers=headers).json()
    assert mats and all(m["site_id"] == seed_data["site_id"] for m in mats)

    # A different (non-existent) site has no materials.
    empty = client.get("/materials", params={"site_id": 99999}, headers=headers).json()
    assert empty == []


def test_engineer_posts_daily_update_manager_sees_it(client, seed_data):
    eng = login(client, "engineer@test.dev")
    res = client.post(
        "/engineering/daily-updates",
        json={"site_id": seed_data["site_id"], "progress_percent": 55, "summary": "Slab poured", "labor_count": 22},
        headers=eng,
    )
    assert res.status_code == 201, res.text
    assert res.json()["progress_percent"] == 55

    mgr = login(client, "manager@test.dev")
    updates = client.get("/engineering/daily-updates", params={"site_id": seed_data["site_id"]}, headers=mgr).json()
    assert any(u["summary"] == "Slab poured" for u in updates)


def test_material_request_issue_draws_stock_fifo(client, seed_data):
    eng = login(client, "engineer@test.dev")
    req = client.post(
        "/engineering/material-requests",
        json={"site_id": seed_data["site_id"], "needed_for": "slab",
              "items": [{"material_id": seed_data["cement_id"], "quantity": 30}]},
        headers=eng,
    )
    assert req.status_code == 201, req.text
    assert req.json()["status"] == "pending"
    request_id = req.json()["id"]

    stock = login(client, "stock@test.dev")
    before = next(
        m for m in client.get("/materials", params={"site_id": seed_data["site_id"]}, headers=stock).json()
        if m["id"] == seed_data["cement_id"]
    )["current_stock"]

    issue = client.post(f"/engineering/material-requests/{request_id}/issue", headers=stock)
    assert issue.status_code == 200 and issue.json()["status"] == "issued"

    after = next(
        m for m in client.get("/materials", params={"site_id": seed_data["site_id"]}, headers=stock).json()
        if m["id"] == seed_data["cement_id"]
    )["current_stock"]
    assert after == before - 30  # 80 -> 50


def test_engineer_role_guards(client, seed_data):
    # Manager cannot post a site-engineer daily update.
    mgr = login(client, "manager@test.dev")
    assert client.post(
        "/engineering/daily-updates",
        json={"site_id": seed_data["site_id"], "progress_percent": 10, "summary": "x"},
        headers=mgr,
    ).status_code == 403

    # A vendor cannot issue a material request.
    eng = login(client, "engineer@test.dev")
    rid = client.post(
        "/engineering/material-requests",
        json={"site_id": seed_data["site_id"], "items": [{"material_id": seed_data["cement_id"], "quantity": 5}]},
        headers=eng,
    ).json()["id"]
    vendor = login(client, "vendor@test.dev")
    assert client.post(f"/engineering/material-requests/{rid}/issue", headers=vendor).status_code == 403
