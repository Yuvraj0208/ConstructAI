"""Tests for the AI layer (status, NL insights, AI budgeting) on the rule-based
fallback path — so they run with no Claude key."""
from __future__ import annotations

import base64

# A 1×1 transparent PNG — enough to exercise the upload + storage path.
PNG_1x1 = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
)


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


def test_engineer_uploads_photo_and_manager_sees_report(client, seed_data):
    eng = login(client, "engineer@test.dev")
    up = client.post(
        "/engineering/site-photos",
        data={"site_id": seed_data["site_id"], "caption": "Block A"},
        files={"file": ("site.png", PNG_1x1, "image/png")},
        headers=eng,
    )
    assert up.status_code == 201, up.text
    body = up.json()
    assert body["used_ai"] is False  # no key -> placeholder report
    assert body["status"] == "pending"
    assert body["image_data_url"].startswith("data:image/")
    report_id = body["id"]

    # Manager can list reports and fetch the image detail.
    mgr = login(client, "manager@test.dev")
    listing = client.get(
        "/engineering/site-photos", params={"site_id": seed_data["site_id"]}, headers=mgr
    )
    assert listing.status_code == 200
    assert any(r["id"] == report_id for r in listing.json())

    detail = client.get(f"/engineering/site-photos/{report_id}", headers=mgr)
    assert detail.status_code == 200
    assert detail.json()["image_data_url"].startswith("data:image/")


def test_photo_upload_requires_engineer(client, seed_data):
    mgr = login(client, "manager@test.dev")
    res = client.post(
        "/engineering/site-photos",
        data={"site_id": seed_data["site_id"]},
        files={"file": ("site.png", PNG_1x1, "image/png")},
        headers=mgr,
    )
    assert res.status_code == 403, res.text


def test_photo_upload_rejects_non_image(client, seed_data):
    eng = login(client, "engineer@test.dev")
    res = client.post(
        "/engineering/site-photos",
        data={"site_id": seed_data["site_id"]},
        files={"file": ("notes.txt", b"hello", "text/plain")},
        headers=eng,
    )
    assert res.status_code == 400, res.text


# --- Note search (keyword RAG) ---
def test_note_search_finds_daily_update(client, seed_data):
    eng = login(client, "engineer@test.dev")
    up = client.post(
        "/engineering/daily-updates",
        json={
            "site_id": seed_data["site_id"],
            "progress_percent": 40,
            "summary": "Extra concrete pour on Block B foundation today",
            "labor_count": 20,
            "issues": "waiting on steel delivery",
        },
        headers=eng,
    )
    assert up.status_code == 201, up.text
    mgr = login(client, "manager@test.dev")
    res = client.get(
        "/ai/notes/search",
        params={"site_id": seed_data["site_id"], "q": "concrete pour Block B"},
        headers=mgr,
    )
    assert res.status_code == 200, res.text
    hits = res.json()["hits"]
    assert len(hits) >= 1
    assert hits[0]["source"] == "Daily update"
    assert "block" in hits[0]["text"].lower()


def test_note_search_requires_manager(client, seed_data):
    stock = login(client, "stock@test.dev")
    res = client.get(
        "/ai/notes/search", params={"site_id": seed_data["site_id"], "q": "x"}, headers=stock
    )
    assert res.status_code == 403, res.text


# --- AI auto-draft purchase orders ---
def test_ai_draft_orders_creates_suggestions(client, seed_data):
    mgr = login(client, "manager@test.dev")
    res = client.post("/ai/draft-orders", params={"site_id": seed_data["site_id"]}, headers=mgr)
    assert res.status_code == 200, res.text
    orders = res.json()
    assert len(orders) >= 1
    assert all(o["status"] == "suggested" for o in orders)
    assert any(o["material_name"] == "Cement" for o in orders)


def test_draft_orders_requires_manager(client, seed_data):
    eng = login(client, "engineer@test.dev")
    res = client.post("/ai/draft-orders", params={"site_id": seed_data["site_id"]}, headers=eng)
    assert res.status_code == 403, res.text


# --- Schedule milestones ---
def test_milestone_crud(client, seed_data):
    mgr = login(client, "manager@test.dev")
    created = client.post(
        "/schedule/milestones",
        json={"site_id": seed_data["site_id"], "title": "Foundation complete", "target_date": "2026-07-15"},
        headers=mgr,
    )
    assert created.status_code == 201, created.text
    mid = created.json()["id"]
    assert created.json()["status"] == "pending"

    listing = client.get("/schedule/milestones", params={"site_id": seed_data["site_id"]}, headers=mgr)
    assert listing.status_code == 200
    assert any(m["id"] == mid for m in listing.json())

    done = client.patch(f"/schedule/milestones/{mid}", json={"status": "done"}, headers=mgr)
    assert done.status_code == 200
    assert done.json()["status"] == "done"

    assert client.delete(f"/schedule/milestones/{mid}", headers=mgr).status_code == 204


def test_milestone_create_requires_manager(client, seed_data):
    eng = login(client, "engineer@test.dev")
    res = client.post(
        "/schedule/milestones",
        json={"site_id": seed_data["site_id"], "title": "X", "target_date": "2026-07-15"},
        headers=eng,
    )
    assert res.status_code == 403, res.text


def test_engineer_can_mark_milestone_done(client, seed_data):
    mgr = login(client, "manager@test.dev")
    mid = client.post(
        "/schedule/milestones",
        json={"site_id": seed_data["site_id"], "title": "Slab", "target_date": "2026-07-15"},
        headers=mgr,
    ).json()["id"]
    eng = login(client, "engineer@test.dev")
    res = client.patch(f"/schedule/milestones/{mid}", json={"status": "done"}, headers=eng)
    assert res.status_code == 200, res.text
    assert res.json()["status"] == "done"


# --- Multi-site portfolio rollup ---
def test_portfolio_rollup(client, seed_data):
    mgr = login(client, "manager@test.dev")
    res = client.get("/portfolio", headers=mgr)
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["totals"]["sites"] >= 1
    site = next((s for s in body["sites"] if s["name"] == "Test Site"), None)
    assert site is not None
    assert site["low"] >= 1  # seeded cement is low (80/100)
    assert body["insight"]


def test_portfolio_requires_manager(client, seed_data):
    stock = login(client, "stock@test.dev")
    res = client.get("/portfolio", headers=stock)
    assert res.status_code == 403, res.text
