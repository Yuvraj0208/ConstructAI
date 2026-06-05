# ConstructAI — Material Procurement Platform

An AI-ready material procurement system. It tracks material stock, lets vendors
post price + delivery ETA, and (next milestone) auto-reorders by balancing price
against delivery speed when stock dips below threshold — with a manager approving.

Built **industry-agnostic**: start with construction (cement, sand, bricks…),
extend to electrical / plumbing / manufacturing without code changes.

> Status: **Milestones 1 & 2 complete** and verified end-to-end — auth + 3 role
> dashboards, stock ledger, vendor offers, usage analytics with anomaly detection,
> the **auto-procurement engine** (price-vs-ETA-vs-urgency scoring + approval flow),
> and the **weather module** (live forecast + rain buffer). See the [roadmap](#roadmap).

---

## Three roles

| Role | What they do |
|------|--------------|
| **Stock Handler** | Track material levels; log usage (out) and deliveries (in). |
| **Manager** | Dashboards, set reorder thresholds, view weather, spot anomalies (e.g. a cement-usage spike → possible theft), run the engine, and approve/reject auto-orders. |
| **Vendor** | Post price + delivery ETA per material; the engine ranks every offer. |

## Tech stack

- **Backend:** FastAPI (Python 3.14) · SQLAlchemy · SQLite (dev) · JWT auth
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
│  │  ├─ services/        # procurement engine + weather provider (the "brain")
│  │  └─ routers/         # auth, industries, materials, stock, vendors, procurement, weather
│  ├─ tests/             # pytest: engine unit tests + API integration tests
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

You need **Python 3.14** and **Node 18+** (Node 24 tested).

### 1. Backend (terminal 1)

```powershell
cd backend
python -m venv .venv                 # first time only
.\.venv\Scripts\python.exe -m pip install -r requirements.txt   # first time only
.\.venv\Scripts\python.exe -m app.seed --reset    # load demo data (first time / to reset)
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000
```

API runs at http://localhost:8000 — interactive docs at http://localhost:8000/docs

### 2. Frontend (terminal 2)

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
| Vendor | `vendor1@constructai.dev` (also vendor2 / vendor3) |

The login screen has one-click buttons to fill these in.

### Tests

```powershell
cd backend
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt   # first time
.\.venv\Scripts\python.exe -m pytest
```

14 tests: procurement-engine unit tests (urgency, scoring, allocation, rain buffer)
+ API integration tests (auth, role guards, and the full suggest→approve→accept→receive lifecycle).

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
- [x] Hardened: 14 automated tests, code-split bundle, 401 auto-logout, ≥32-byte JWT secret

**Weather module (done)**
- [x] City-wise live forecast (Open-Meteo, key-less; offline simulation fallback)
- [x] +20% rain buffer applied to weather-sensitive materials during reorder

**Milestone 3 — AI layer (next)**
- [ ] Agents to interlink procurement with budgeting & scheduling; contextual RAG
- [ ] Natural-language insights ("why did cement spike?", "what should I order?")

---

## Notes

- The dev database is a local SQLite file (`backend/constructai.db`, git-ignored).
  Schema changes during early dev: re-run `python -m app.seed --reset`.
- `SECRET_KEY` defaults to a dev value — set a real one via `backend/.env`
  (copy `.env.example`) before any real deployment.
