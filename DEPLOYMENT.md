# Deploying ConstructAI (Vercel + Render)

Frontend → **Vercel** (static, instant). Backend + Postgres → **Render** (free tier).
Both deploy straight from this GitHub repo and are pre-configured — you just click
through (I can't sign into your accounts for you).

## 1. Backend + database on Render

1. Sign in at https://render.com with your GitHub account.
2. **New → Blueprint**, choose the `ConstructAI` repo, approve access. Render reads
   [`render.yaml`](render.yaml) and provisions:
   - a free **PostgreSQL** database (`constructai-db`), and
   - the **FastAPI** web service (`constructai-api`).
   `SECRET_KEY` is auto-generated and `DATABASE_URL` is auto-linked. On first boot it
   runs the Alembic migrations and seeds the demo data automatically.
3. Click **Apply**. First build is ~3–5 min. When live, copy the service URL, e.g.
   `https://constructai-api.onrender.com`. Visit `…/health` (should return
   `{"status":"healthy"}`) and `…/docs` for the interactive API.

## 2. Frontend on Vercel

1. Sign in at https://vercel.com with GitHub → **Add New → Project** → import `ConstructAI`.
2. Set **Root Directory = `frontend`** (it auto-detects Vite).
3. Add an **Environment Variable**:
   - `VITE_API_URL` = your Render URL from step 1 (e.g. `https://constructai-api.onrender.com`)
4. **Deploy**. Your app is live at `https://<project>.vercel.app`.

CORS already allows `*.vercel.app`, so it works out of the box. (Custom domain? Add it
to the `CORS_ORIGINS` env var on the Render service.)

## 3. Keep it fast (minimize cold starts)

Render's free backend sleeps after ~15 min idle (the next request then takes ~30–50s).
To keep it warm, in GitHub go to **Settings → Secrets and variables → Actions → New
repository secret**:
- `BACKEND_URL` = your Render URL (e.g. `https://constructai-api.onrender.com`)

The included workflow [`.github/workflows/keep-warm.yml`](.github/workflows/keep-warm.yml)
then pings `/health` every ~10 min. (A free https://uptimerobot.com monitor at 5-min
intervals is even more reliable.)

> **Truly zero delay** needs an always-on instance — upgrade the Render service to the
> Starter plan (~$7/mo) and it never sleeps. The Vercel frontend is always instant.

## 4. AI provider (optional)

The AI features (Ask ConstructAI, Budget, AI draft orders, photo vision) run on a built-in
**rule-based fallback** by default — zero setup, zero cost — and the dashboard shows a
**"Live AI" / "Demo"** badge. To switch to a real model, set `AI_PROVIDER` plus its settings:

- **Free & local — Ollama** *(best for development / self-hosting; no API bill)*: install
  [Ollama](https://ollama.com), then `ollama pull llama3.1` and `ollama pull llama3.2-vision`,
  and run the backend with `AI_PROVIDER=ollama`. No key, no per-call cost. ⚠️ Ollama needs real
  RAM/GPU, so it **can't run on Render's free tier** — use it locally, or self-host the backend
  on a machine that runs Ollama.
- **Paid / hosted — Claude, OpenAI, Groq, OpenRouter…** *(works on Render)*: set
  `AI_PROVIDER=anthropic` + `ANTHROPIC_API_KEY`, **or** `AI_PROVIDER=openai` + `OPENAI_API_KEY`
  (add `OPENAI_BASE_URL` to point at any OpenAI-compatible host). Add them under the service's
  **Environment** tab → redeploy.

Every variable is documented in [`backend/.env.example`](backend/.env.example). Any provider
error (bad key, model offline, malformed output) **silently degrades to the rule-based fallback**.

## 5. Field app (mobile PWA) — optional

A separate phone-first app for **stock handlers & site engineers** lives in
[`mobile/`](mobile). Deploy it as a **second Vercel project** (it reuses the same backend):

1. Vercel → **Add New → Project** → import the same `ConstructAI` repo.
2. Set **Root Directory = `mobile`** (auto-detects Vite).
3. Add env var `VITE_API_URL` = your Render URL (e.g. `https://constructai-api.onrender.com`).
4. **Deploy.** It lands at its own `*.vercel.app` URL (already CORS-allowed).

Field staff open that link on their phone once and **Add to Home Screen** — it installs as a
full-screen app with its own login (stock handler / site engineer only; managers & vendors are
sent to the web dashboard). It includes camera capture for site photos. Locally:
`cd mobile && npm install && npm run dev`.

## Demo data

The deploy seeds demo data automatically: **5 industries, 6 sites, every role**. Logins
(password `password123`): `manager@`, `stock@`, `engineer@`, `vendor1@constructai.dev`.
To reset the live demo to pristine, open the Render service **Shell** and run:
`python -m app.seed --reset`.
