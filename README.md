<div align="center">

# 🏗️ ConstructAI

### AI-native material procurement for construction — and every other trade.

Track stock, auto-reorder from the best vendor, forecast budgets, and read the
site from a photo. ConstructAI watches every site's inventory, calls the right
vendors the moment you dip below threshold, balances price against delivery speed,
and now reasons about it all in plain English.

[![Live Demo](https://img.shields.io/badge/▶_Live_Demo-construct--ai.vercel.app-6366F1?style=for-the-badge)](https://construct-ai-eosin.vercel.app)

![Python](https://img.shields.io/badge/Python-3.12+-3776AB?logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?logo=fastapi&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?logo=postgresql&logoColor=white)
![React](https://img.shields.io/badge/React_19-20232A?logo=react&logoColor=61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_v4-06B6D4?logo=tailwindcss&logoColor=white)
![Claude](https://img.shields.io/badge/AI-Claude_Opus_4.8-D97757?logo=anthropic&logoColor=white)

**Milestones 1–4 complete** · 4 role workspaces · 5 industries · auto-procurement engine · live weather · AI insights, budgeting, vision, note-search, scheduling, a portfolio rollup & a mobile field app

</div>

---

## Table of contents

- [What is ConstructAI?](#what-is-constructai)
- [Highlights](#highlights)
- [The four roles](#the-four-roles)
- [The AI layer (Milestone 3)](#the-ai-layer-milestone-3)
- [How the procurement engine works](#how-the-procurement-engine-works)
- [Tech stack](#tech-stack)
- [Project structure](#project-structure)
- [Run it locally](#run-it-locally)
- [Deploy (Vercel + Render)](#deploy-vercel--render)
- [API reference](#api-reference)
- [Roadmap](#roadmap)
- [Configuration & notes](#configuration--notes)

---

## What is ConstructAI?

Construction (and electrical, plumbing, HVAC, painting…) runs on materials arriving
on time at the right price. Run out of cement and the pour stops; over-order and cash
is tied up in a yard. ConstructAI turns material procurement into a closed loop:

> **Stock handlers** log what's used → the system spots low/critical materials →
> the **auto-procurement engine** ranks every vendor by price vs. delivery speed and
> drafts orders → the **manager** approves → the **vendor** confirms → stock is
> received back in. Meanwhile **site engineers** send daily progress and request
> materials, **live weather** buffers rain-sensitive stock, and an **AI layer**
> answers questions, proposes budgets, and reads site photos.

It's built **industry-agnostic** from the ground up — the same platform ships with
**five fully-working industries**, and a company can run **many sites** at once, each
with its own stock and procurement, switchable from the top bar.

**[▶ Try the live demo →](https://construct-ai-eosin.vercel.app)** (log in with any
account below — the login screen has one-click buttons; the free backend may take
~30s to wake on the first request, then it's fast.)

---

## Highlights

**📦 Inventory that reflects reality**
- Per-material **thresholds** with ok / low / critical status
- Append-only **stock ledger** (usage / delivery / adjustment)
- **Per-batch expiry** — deliveries become batches, consumption is **FIFO** (oldest
  expiry first), and the manager sees expired / expiring-soon alerts
- **Safety reserves** — hold back `reserve_percent` per material; everything works off
  *available* stock (current − reserved)

**🤖 Auto-procurement engine**
- The moment available stock ≤ threshold, score every active vendor offer on
  **price vs. ETA vs. urgency** (weighting shifts toward *speed* as the shortage gets
  critical) and **split the order** across vendors to hit the deadline at the best price
- Full lifecycle: engine **suggests** → manager **approves / rejects** → vendor
  **accepts** → stock handler **receives** (auto stock movement + new batch)

**🌦️ Weather-aware**
- City-wise live forecast (Open-Meteo, key-less; deterministic offline fallback)
- Automatic **+20% buffer** on weather-sensitive materials when rain is coming

**📈 Usage analytics & anomaly detection**
- 14-day consumption charts per material with **spike detection** (mean + 2σ) to flag
  possible waste or theft

**🏢 Multi-site, multi-industry**
- **Sites** are the operational unit; a **site switcher** scopes every screen
- A **portfolio rollup** aggregates stock, spend, progress & schedule risk across all sites
- **5 industries** shipped end-to-end — Construction, Electrical, Plumbing, HVAC, Painting

**🧠 AI layer** — natural-language insights, AI-proposed budgeting, site-photo vision
analysis, keyword **note search**, an **AI purchase-order drafting agent**, and **schedule
milestones** the AI reasons about (see [below](#the-ai-layer-milestone-3)).

**📱 Field app (installable mobile PWA)** — a separate phone-first app in [`mobile/`](mobile)
for **stock handlers & site engineers** to post from site: record movements, issue requests,
receive deliveries, send daily updates, request materials, and **snap + upload site photos**
(camera capture). Own login, bottom-tab nav, "Add to Home Screen" → runs full-screen like a
native app. Reuses the same API; deploy as a second Vercel project (see [DEPLOYMENT.md](DEPLOYMENT.md)).

**🎨 A UI that doesn't look generic** — a "Blueprint Aurora" construction theme with a
dusk-skyline + tower-crane hero, scroll-animated landing, and a **per-role themed
workspace** (Manager = indigo/analytics, Stock = amber/warehouse, Engineer =
emerald/on-site, Vendor = sky/logistics).

---

## The four roles

A company runs **multiple sites** (each belongs to an industry and owns its own
stock/procurement). Every role except Vendor gets a **site switcher** in the top bar.

| Role | What they do |
|------|--------------|
| 📊 **Manager** | Live dashboards, thresholds, weather, anomaly detection. Run the auto-procurement engine, approve/reject orders, watch site progress — plus the **AI insights, budget forecast, and site-photo reports**. |
| 📦 **Stock Handler** | Track levels; log usage/deliveries; **issue** the engineer's material requests (draws stock FIFO); receive purchase orders into stock. |
| 👷 **Site Engineer** | Post **daily progress updates** (progress %, labour, blockers, weather impact), **request materials** for the day, and **upload site photos** for AI analysis. |
| 🚚 **Vendor** | Post price + delivery ETA per material across every industry; the engine ranks every offer and routes won orders here to accept. |

---

## The AI layer (Milestone 3)

The AI features run on a **pluggable LLM provider** — pick one with `AI_PROVIDER`:
**Ollama** (local & free, no key), **Claude**, or any **OpenAI-compatible** host (OpenAI,
Groq, OpenRouter…). Everything **degrades to a deterministic, rule-based engine when no
provider is configured** — so the public demo always works at zero cost, and the dashboard
shows a **"Live AI" / "Demo"** badge. Pick a provider and the same features run through it.

### 🔀 Pluggable provider & graceful fallback
All four AI features run on whichever backend you choose with **`AI_PROVIDER`** — and a single
[`provider.py`](backend/app/services/ai/provider.py) adapts each one's API (Anthropic's
`messages` vs. the OpenAI `chat` format):

| `AI_PROVIDER` | Backend | Cost | Notes |
|---|---|---|---|
| *(unset)* | **Rule-based fallback** | Free | Deterministic engine — the default; nothing to install |
| `ollama` | **Local Ollama** | **Free** | Runs on your own machine: `llama3.1` (Ask / budget / draft orders) + `moondream` (photo vision). No key, no cloud, no per-call cost |
| `gemini` | **Google Gemini** | **Free tier** | Hosted + multimodal → works on Render. `GEMINI_API_KEY` from [aistudio.google.com](https://aistudio.google.com) (rate-limited, no card) |
| `anthropic` | **Claude** | Paid | `ANTHROPIC_API_KEY` |
| `openai` | **OpenAI · Groq · OpenRouter · …** | Paid | `OPENAI_API_KEY` (+ `OPENAI_BASE_URL` for any OpenAI-compatible host) |

**Every call is wrapped so any failure — missing key, model offline, malformed output —
silently degrades to the rule-based engine.** That's why the hosted demo always works with no
provider, and why a tiny local model that merely *describes* a photo still yields a usable
report. Uploaded photos are auto-converted to JPEG so any format (incl. WebP/HEIC) works with
local vision models.

### 🧠 Ask ConstructAI — natural-language insights
A chat panel on the manager dashboard. Ask things like *"what should I order?"*,
*"why did cement usage spike?"*, or *"are we on budget?"* and get an answer **grounded
in that site's live data**, with **source chips** showing what it looked at. With a key,
it's an **agentic tool-calling loop**: Claude pulls exactly the data it needs (stock,
vendor offers, weather, labour, spend, progress) before answering — the "contextual RAG"
is structured tool-calls over the live database, so answers can't hallucinate the numbers.

### 💰 Budget & Forecast — AI proposes, you adjust
An **AI-proposed budget** that connects vendor prices, labour (daily-update headcount ×
rate), schedule progress, and **weather risk** into materials / labour / contingency.
It then tracks **actual spend vs. budget** and forecasts overrun risk
(*"Overrun risk — projected ₹X exceeds the ₹Y budget at 45% complete; rain may lift
material costs"*). The manager can **re-propose** or fine-tune the totals.

### 📸 Site-photo vision analysis
A site engineer uploads a progress photo; Claude **vision** returns a structured report —
estimated completion %, key observations, **safety flags** (missing PPE / hazards),
materials visible, and an overall status — which lands in the **manager's photo-reports
grid**. (Photos are stored in Postgres so they survive the free tier's ephemeral disk.)

### 🔎 Search the site log (note retrieval / RAG)
Keyword search across the site's free-text history — daily updates, material requests,
purchase-order rationales, stock notes and photo reports — so the agent can recall *why*
something happened. It's both a **"search the site log"** box and a tool the agent calls.
Lexical today, with a clean seam to add real vector embeddings behind a key later.

### 🧾 AI draft-orders agent
One click drafts purchase orders for the manager to approve. The agent only ever picks from
**real** vendor offers and stays within the **remaining budget** — so it can't invent prices
or vendors. With no key it falls back to the deterministic auto-procurement engine.

### 🗓️ Schedule milestones
Per-site milestones with **overdue / at-risk** tracking. The AI folds schedule risk into its
answers (*"Phase 2 overdue by 4 days"*); the labour rate that drives the budget is editable
inline.

> **Turn on real AI:** for **free & local**, install [Ollama](https://ollama.com), pull
> `llama3.1` + `llama3.2-vision`, and run the backend with `AI_PROVIDER=ollama` — no key, no
> per-call cost (great for dev; it can't run on Render's free tier, so the hosted demo stays
> on the fallback). For a **hosted** model, set `AI_PROVIDER=anthropic`/`openai` + the key.
> No provider = the rule-based demo keeps running for free. (See [DEPLOYMENT.md](DEPLOYMENT.md).)

---

## How the procurement engine works

When a material's **available** stock falls to/below its threshold, the engine
([`backend/app/services/procurement.py`](backend/app/services/procurement.py)):

1. **Computes the quantity** to order (refill toward target, **+ rain buffer** if the
   material is weather-sensitive and rain is forecast).
2. **Scores every active offer** — normalised price and ETA combined with the vendor's
   rating. The weights shift with urgency:
   `w_price = 0.6 − 0.4·urgency`, `w_eta = 0.3 + 0.5·urgency` — i.e. when stock is
   critical, **speed outweighs price**.
3. **Allocates greedily** across the best offers, so a critical shortfall will buy some
   from a faster-but-pricier vendor to cover the gap, and writes a human-readable
   `rationale` on each suggested order.

Everything is unit-tested (urgency curve, scoring, multi-vendor allocation, rain buffer).

---

## Tech stack

| Layer | Tech |
|-------|------|
| **Backend** | FastAPI · SQLAlchemy 2.0 · **PostgreSQL** (psycopg; SQLite for tests/dev) · Alembic migrations · Pydantic v2 · JWT (PyJWT) + PBKDF2 hashing |
| **AI** | Pluggable provider — **Ollama** (local/free), **Claude**, or any **OpenAI-compatible** host (tool-use agent, structured-output budgeting, vision) with a rule-based no-key fallback |
| **Frontend** | React 19 · TypeScript · Vite · Tailwind CSS v4 · Recharts · React Router (lazy/code-split) · axios |
| **Weather** | Open-Meteo (key-less) + offline simulation |
| **Deploy** | Vercel (frontend) · Render (FastAPI + Postgres, blueprint) · GitHub Actions keep-warm |

---

## Project structure

```
ConstructAI/
├─ backend/
│  ├─ app/
│  │  ├─ main.py            # FastAPI app + CORS + router wiring
│  │  ├─ config.py          # settings (env / .env), incl. ANTHROPIC_API_KEY
│  │  ├─ database.py        # engine + session + Base
│  │  ├─ models.py          # ORM models (industry-agnostic; Budget, SiteImageReport…)
│  │  ├─ schemas.py         # Pydantic request/response contracts
│  │  ├─ security.py        # password hashing (PBKDF2) + JWT
│  │  ├─ deps.py            # current-user + role guards
│  │  ├─ seed.py            # demo data (run with --reset to wipe)
│  │  ├─ services/
│  │  │  ├─ procurement.py  # the auto-reorder engine (scoring + allocation)
│  │  │  ├─ inventory.py    # batches / FIFO consumption / expiry
│  │  │  ├─ weather.py      # Open-Meteo + offline simulation
│  │  │  └─ ai/             # AI layer: client, context (RAG), tools, agent,
│  │  │                     #   budget, vision, fallback
│  │  └─ routers/           # auth, industries, sites, materials, stock, vendors,
│  │                        #   procurement, weather, engineering, ai
│  ├─ tests/                # pytest — engine, inventory, API lifecycle, AI (43 tests)
│  ├─ alembic/              # database migrations (alembic upgrade head)
│  └─ requirements.txt
├─ frontend/
│  └─ src/
│     ├─ api/client.ts          # axios + token handling
│     ├─ auth/AuthContext.tsx   # login / signup / session
│     ├─ site/SiteContext.tsx   # multi-site switcher state
│     ├─ components/            # Layout, RoleBackdrop, icons, SitePhotosPanel, UI kit
│     └─ pages/                # Landing, Login, Signup + manager/stock/engineer/vendor
└─ mobile/                     # installable field PWA (stock handler + site engineer)
   └─ src/                     # AppShell (bottom tabs), pages/stock/*, pages/engineer/*
```

---

## Run it locally

**Prerequisites:** Python 3.12+ · Node 18+ · PostgreSQL (or use SQLite for zero setup).

### 1. Database

```sql
-- in psql / pgAdmin
CREATE DATABASE constructai;
```

```bash
cd backend
cp .env.example .env          # then set your password in DATABASE_URL
#   DATABASE_URL=postgresql+psycopg://postgres:YOUR_PASSWORD@localhost:5432/constructai
#   (or, zero-setup: DATABASE_URL=sqlite:///./constructai.db)
```

### 2. Backend  *(terminal 1)*

```bash
cd backend
python -m venv .venv
.venv/Scripts/python.exe -m pip install -r requirements.txt
.venv/Scripts/python.exe -m alembic upgrade head      # create/upgrade schema
.venv/Scripts/python.exe -m app.seed --reset          # load demo data
.venv/Scripts/python.exe -m uvicorn app.main:app --reload --port 8000
```

API → http://localhost:8000 · interactive docs → http://localhost:8000/docs

> **Optional — enable live Claude:** add `ANTHROPIC_API_KEY=sk-ant-...` to `backend/.env`.
> Without it, the AI features run in rule-based demo mode.

### 3. Frontend  *(terminal 2)*

```bash
cd frontend
npm install
npm run dev
```

App → **http://localhost:5173**

### Demo accounts  *(password: `password123`)*

| Role | Email |
|------|-------|
| Manager | `manager@constructai.dev` |
| Stock Handler | `stock@constructai.dev` |
| Site Engineer | `engineer@constructai.dev` |
| Vendor | `vendor1@constructai.dev` (also `vendor2@`, `vendor3@`) |

The Manager / Stock / Engineer logins roam **every site** via the switcher. The login
screen has one-click buttons to fill these in.

### Tests

```bash
cd backend
.venv/Scripts/python.exe -m pip install -r requirements-dev.txt
.venv/Scripts/python.exe -m pytest
```

**41 tests** — engine (urgency, scoring, allocation, rain buffer), inventory
(reserve/available, batch FIFO, expiry buckets), API lifecycle (auth, role guards, site
scoping, suggest→approve→accept→receive, engineer daily-update + material-request →
issue), and the AI layer (status, insights, budgeting, photo vision, note search, AI
draft-orders, schedule milestones, portfolio rollup) on the no-key path.

---

## Deploy (Vercel + Render)

Frontend → **Vercel**, backend + Postgres → **Render**, both straight from this repo.
It's pre-wired ([`render.yaml`](render.yaml), [`frontend/vercel.json`](frontend/vercel.json),
keep-warm workflow) and **auto-migrates + seeds demo data on deploy**. Set
`ANTHROPIC_API_KEY` on Render to switch the AI from demo to live. Full step-by-step:
**[DEPLOYMENT.md](DEPLOYMENT.md)**.

---

## API reference

Interactive OpenAPI docs are at `/docs`. Highlights:

<details>
<summary><b>Auth, catalog & stock</b></summary>

| Method | Path | Notes |
|--------|------|-------|
| `POST` | `/auth/signup`, `/auth/login` | returns a JWT + user |
| `GET`  | `/auth/me` | current user |
| `GET`  | `/industries`, `/sites` | catalog (sites filtered to the user) |
| `GET`/`POST` | `/materials` | per-site materials (incl. reserve & available) |
| `GET`/`POST` | `/stock/movements` | the ledger; `GET /stock/daily-usage` powers charts |
| `GET`  | `/stock/batches`, `/stock/expiry` | per-batch expiry tracking |
</details>

<details>
<summary><b>Vendors & procurement</b></summary>

| Method | Path | Notes |
|--------|------|-------|
| `GET`/`POST`/`DELETE` | `/vendors/offers` | vendors post/withdraw price + ETA |
| `POST` | `/procurement/run?site_id=` | run the engine → suggested orders |
| `GET`  | `/procurement/orders` | role-scoped order list |
| `POST` | `/procurement/orders/{id}/approve` · `/reject` · `/accept` · `/receive` | lifecycle |
| `GET`  | `/weather?site_id=` | city forecast + rain advisory |
</details>

<details>
<summary><b>Site engineering & AI</b></summary>

| Method | Path | Notes |
|--------|------|-------|
| `GET`/`POST` | `/engineering/daily-updates` | progress reports → manager |
| `GET`/`POST` | `/engineering/material-requests` | + `/{id}/issue`, `/{id}/reject` |
| `POST` | `/engineering/site-photos` | engineer uploads a photo → AI vision report |
| `GET`  | `/engineering/site-photos` · `/{id}` | reports list / image detail |
| `GET`  | `/ai/status` | live-AI vs. demo mode |
| `POST` | `/ai/ask` | natural-language insight (manager) |
| `GET`/`POST` | `/ai/budget` · `/ai/budget/propose` | AI-proposed budget + forecast |
| `PATCH`| `/ai/budget/{id}` | manager adjusts the budget |
| `GET`  | `/ai/notes/search` | keyword search across the site's notes & updates |
| `POST` | `/ai/draft-orders` | AI drafts purchase orders for approval |
| `GET`/`POST`/`PATCH`/`DELETE` | `/schedule/milestones` | per-site schedule milestones |
| `GET`  | `/portfolio` | executive rollup across all of a manager's sites |
</details>

---

## Roadmap

**Milestone 1 — Foundation** ✅
- [x] Auth + role-based dashboards + landing role-chooser
- [x] Material catalog with thresholds & status, stock ledger, vendor offers
- [x] Usage analytics + anomaly (theft/waste) detection

**Milestone 2 — Auto-procurement engine** ✅
- [x] Price-vs-ETA-vs-urgency scoring with multi-vendor allocation
- [x] Order lifecycle: approve → accept → receive; hardened with tests, code-split, auto-logout

**Weather, inventory depth & PostgreSQL** ✅
- [x] Live city-wise forecast + rain buffer
- [x] Per-batch **expiry** (FIFO) and **reserve** safety stock
- [x] Migrated to **PostgreSQL** with **Alembic** migrations

**Multi-site, Site Engineer & 5 industries** ✅
- [x] Sites as the operational unit + top-bar switcher
- [x] Site Engineer role (daily updates + material requests)
- [x] Construction, Electrical, Plumbing, HVAC, Painting — each fully built

**Milestone 3 — AI layer** ✅
- [x] **Phase 1** — agentic natural-language insights (contextual RAG over live data) +
      AI-proposed budgeting that links procurement, labour & weather
- [x] **Phase 2** — site-photo **vision** analysis (progress %, safety flags, materials)
- [x] No-key rule-based fallback so the demo runs free; one switch flips it to live Claude

**Milestone 4 — Deeper AI** ✅
- [x] **Note search (RAG)** — keyword retrieval over daily updates, requests, order
      rationales & photo reports, surfaced to the agent and a "search the site log" box
- [x] **AI draft-orders agent** — drafts purchase orders (from real offers, within budget)
      for the manager to approve
- [x] **Schedule milestones** — per-site milestones with overdue / at-risk tracking that the
      AI ties into its answers (labour rate is configurable in the budget panel)
- [x] **Multi-site portfolio rollup** — an executive overview aggregating stock, spend,
      progress & schedule risk across every site, flagging which need attention

**Future ideas**
- [ ] Real vector embeddings behind an optional key (e.g. Voyage AI) for semantic search
- [ ] Auto-notify vendors / managers on critical shortfalls
- [ ] Weekly executive digest / scheduled reports

---

## Configuration & notes

- **Database** is configured via `backend/.env` (`DATABASE_URL`). The schema is managed
  by **Alembic** — after editing models run
  `alembic revision --autogenerate -m "..."` then `alembic upgrade head`.
  `python -m app.seed --reset` resets demo **data** only.
- **Secrets:** `SECRET_KEY` defaults to a dev value — set a real one in `.env` before any
  real deployment. `ANTHROPIC_API_KEY` is optional (enables live Claude). Neither is
  committed.
- **Local dev** built on Python 3.14; Render pins Python 3.12.6 (the app supports 3.12+).

<div align="center">

**[▶ Live demo](https://construct-ai-eosin.vercel.app)** · Built with FastAPI, React & Claude

</div>
