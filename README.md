# ConstructAI — Material Procurement Platform

An AI-ready material procurement system. It tracks material stock (with per-batch
expiry and safety-stock reserves), lets vendors post price + delivery ETA, and
auto-reorders by balancing price against delivery speed when stock dips below
threshold — with a manager approving.

Built **industry-agnostic** and shipping with **5 industries** — Construction,
Electrical, Plumbing, HVAC, and Painting & Finishing — each fully functional.

> Status: **Milestones 1 & 2 + extras complete** and verified end-to-end — auth + 3
> role dashboards, stock ledger, vendor offers, usage analytics with anomaly detection,
> the **auto-procurement engine** (price-vs-ETA-vs-urgency + approval flow), the
> **weather module** (live forecast + rain buffer), **per-batch expiry tracking** (FIFO),
> and **reserve safety stock** per material. Runs on **PostgreSQL**. See the [roadmap](#roadmap).

---

## Four roles, multiple sites

A company runs **multiple sites** (each belongs to an industry and owns its own
stock/procurement). Every role gets a **site switcher** in the top bar.

| Role | What they do |
|------|--------------|
| **Stock Handler** | Track material levels; log usage/deliveries; **issue** the engineer's material requests; receive purchase orders. |
| **Manager** | Dashboards, thresholds, weather, anomaly detection, run the auto-procurement engine, approve/reject orders, and watch **site progress**. |
| **Site Engineer** | Post **daily progress updates** (with blockers, labor, weather impact) and **request materials** for the day. |
| **Vendor** | Post price + delivery ETA per material; the engine ranks every offer. |

## Tech stack

- **Backend:** FastAPI (Python 3.14) · SQLAlchemy · PostgreSQL (psycopg; SQLite also supported) · JWT auth
- **Frontend:** React 19 + TypeScript · Vite · Tailwind CSS v4 · Recharts · React Router

## Project structure

```
ConstructAI/
├─ backend/
│  ├─ app/
│  │  ├─ main.py          # FastAPI app + CORS + router wiring
│  │  ├─ config.py        # settings (env / .env)
│  │  ├─ database.py      # engine + session + Base
│  │  ├─ models.py        # ORM models (industry-agnostic schema)
│  │  ├─ schemas.py       # Pydantic request/response contracts
│  │  ├─ security.py      # password hashing (PBKDF2) + JWT
│  │  ├─ deps.py          # current-user + role guards
│  │  ├─ seed.py          # demo data (run with --reset to wipe)
│  │  ├─ services/        # procurement engine + weather + inventory (batches/FIFO/expiry)
│  │  └─ routers/         # auth, industries, materials, stock, vendors, procurement, weather
│  ├─ tests/             # pytest: engine unit tests + API integration tests
│  ├─ alembic/           # database migrations (run: alembic upgrade head)
│  └─ requirements.txt
└─ frontend/
   └─ src/
      ├─ api/client.ts        # axios + token handling
      ├─ auth/AuthContext.tsx  # login / signup / session
      ├─ hooks/useMaterials.ts
      ├─ components/           # Layout, ProtectedRoute, UI kit
      └─ pages/                # Landing, Login, Signup, + 3 dashboards
```

---

## Running it

You need **Python 3.14**, **Node 18+** (Node 24 tested), and **PostgreSQL**.

### 1. Database (PostgreSQL)

Create the database, then point the backend at it via `backend/.env`:

```sql
-- in psql or pgAdmin
CREATE DATABASE constructai;
```

```powershell
cd backend
copy .env.example .env
# then edit .env and set your password in DATABASE_URL:
#   postgresql+psycopg://postgres:YOUR_PASSWORD@localhost:5432/constructai
```

> Prefer zero-setup? Set `DATABASE_URL=sqlite:///./constructai.db` in `.env` instead.

### 2. Backend (terminal 1)

```powershell
cd backend
python -m venv .venv                 # first time only
.\.venv\Scripts\python.exe -m pip install -r requirements.txt   # first time only
.\.venv\Scripts\python.exe -m alembic upgrade head   # create/upgrade the schema (migrations)
.\.venv\Scripts\python.exe -m app.seed --reset       # load demo data (data only)
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000
```

API runs at http://localhost:8000 — interactive docs at http://localhost:8000/docs

### 3. Frontend (terminal 2)

```powershell
cd frontend
npm install        # first time only
npm run dev
```

Open **http://localhost:5173**

### Demo accounts (password: `password123`)

| Role | Email |
|------|-------|
| Manager | `manager@constructai.dev` |
| Stock Handler | `stock@constructai.dev` |
| Site Engineer | `engineer@constructai.dev` |
| Vendor | `vendor1@constructai.dev` (also vendor2 / vendor3) |

The login screen has one-click buttons to fill these in.

### Tests

```powershell
cd backend
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt   # first time
.\.venv\Scripts\python.exe -m pytest
```

21 tests: engine unit tests (urgency, scoring, allocation, rain buffer), inventory tests
(reserve/available, batch FIFO, expiry buckets), and API integration tests (auth, role
guards, reserve fields, expiry alerts, and the full suggest→approve→accept→receive lifecycle).

---

## Roadmap

**Milestone 1 — Foundation (done)**
- [x] Auth + signup/login, 3 role-based dashboards, landing role-chooser
- [x] Material catalog with per-material thresholds + status (ok / low / critical)
- [x] Stock movement ledger (usage / delivery / adjustment)
- [x] Vendor offers (post / withdraw); manager sees all offers
- [x] Usage analytics + anomaly detection (theft/waste flag)

**Milestone 2 — Auto-procurement engine (done)**
- [x] When stock ≤ threshold, score vendor offers (price vs. ETA vs. urgency)
- [x] Allocate the reorder quantity across vendors (buys some from the fast-but-pricier
      vendor when critically low)
- [x] Order lifecycle: manager **approve/reject** → vendor **accepts** → stock handler
      **receives** (auto stock movement). Vendors see their incoming orders.
- [x] Hardened: automated tests, code-split bundle, 401 auto-logout, ≥32-byte JWT secret

**Weather module (done)**
- [x] City-wise live forecast (Open-Meteo, key-less; offline simulation fallback)
- [x] +20% rain buffer applied to weather-sensitive materials during reorder

**Inventory depth & PostgreSQL (done)**
- [x] Migrated to **PostgreSQL** (psycopg); still SQLite-compatible for tests/dev
- [x] **Per-batch expiry** — deliveries become batches; consumption is FIFO (oldest
      expiry first); manager sees expired / expiring-soon alerts
- [x] **Reserve safety stock** — a `reserve_percent` per material held back; status and
      the engine work off *available* (current − reserved) stock
- [x] **Alembic migrations** manage the schema (no more auto-create on startup)
- [x] 21 automated tests covering the above

**Multi-site, Site Engineer & multi-industry (done)**
- [x] **Sites** are the operational unit — each owns its own stock/procurement; a
      **site switcher** in the top bar scopes every screen
- [x] New **Site Engineer** role: daily progress updates (→ manager's Site Progress
      panel) and material requests (→ stock handler issues, drawing stock down FIFO)
- [x] **5 industries** fully built — Construction, Electrical, Plumbing, HVAC, and
      Painting — each with sites, materials, vendors/offers, and demo activity. The
      demo manager/stock/engineer logins roam every site via the switcher.
- [x] 25 automated tests; data migrations preserve existing rows

**Milestone 3 — AI layer (next)**
- [ ] Agents to interlink procurement with budgeting & scheduling; contextual RAG
- [ ] Natural-language insights ("why did cement spike?", "what should I order?")

---

## Notes

- Configure the database via `backend/.env` (`DATABASE_URL`). **Schema is managed by
  Alembic** — after editing models, run `alembic revision --autogenerate -m "..."` then
  `alembic upgrade head`. `python -m app.seed --reset` resets the demo **data** only.
- `SECRET_KEY` defaults to a dev value — set a real one via `backend/.env`
  (copy `.env.example`) before any real deployment.
