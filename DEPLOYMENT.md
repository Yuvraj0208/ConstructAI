# Deploying ConstructAI (Neon + Render + Vercel)

Database → **Neon** (free Postgres, never expires). Backend → **Render** (free web
service). Frontend → **Vercel** (static, instant). All three have permanent free tiers,
deploy straight from this GitHub repo, and are pre-configured — you just click through
(I can't sign into your accounts for you).

## 1. Database on Neon (free, never expires)

> ⚠️ **Do not use Render's free PostgreSQL.** It is **deleted after 30 days**, which takes
> the whole app down. Neon's free plan has no such expiry, so the demo keeps working
> indefinitely at zero cost.

1. Sign up at **https://neon.com** (free, no credit card — you can use GitHub).
2. Create a project (any name, e.g. `constructai`). Pick the region closest to you.
3. Copy the **connection string** it shows you. It looks like:
   `postgresql://user:password@ep-xxx.region.aws.neon.tech/neondb?sslmode=require`
4. Keep it handy for the next step — it goes into `DATABASE_URL` on Render.

Neon's free compute **auto-suspends when idle and wakes on the next connection**; the app
enables `pool_pre_ping`, so it reconnects transparently.

## 2. Backend on Render

1. Sign in at https://render.com with your GitHub account.
2. **New → Blueprint**, choose the `ConstructAI` repo, approve access. Render reads
   [`render.yaml`](render.yaml) and provisions the **FastAPI** web service
   (`constructai-api`). `SECRET_KEY` is auto-generated.
3. When prompted (or afterwards under the service's **Environment** tab), set
   **`DATABASE_URL`** to the Neon connection string from step 1.
4. Click **Apply**. First build is ~3–5 min. On boot it runs the Alembic migrations and
   seeds the demo data automatically into the Neon database.
5. When live, copy the service URL, e.g. `https://constructai-api.onrender.com`. Visit
   `…/health` (should return `{"status":"healthy"}`) and `…/docs` for the interactive API.

> **Already deployed and your Render database expired?** You do not need to recreate the
> service — just set `DATABASE_URL` to the new Neon string under **Environment** and
> redeploy. The start command migrates and seeds the empty database on its own.

## 3. Frontend on Vercel

1. Sign in at https://vercel.com with GitHub → **Add New → Project** → import `ConstructAI`.
2. Set **Root Directory = `frontend`** (it auto-detects Vite).
3. Add an **Environment Variable**:
   - `VITE_API_URL` = your Render URL from step 2 (e.g. `https://constructai-api.onrender.com`)
4. **Deploy**. Your app is live at `https://<project>.vercel.app`.

CORS already allows `*.vercel.app`, so it works out of the box. (Custom domain? Add it
to the `CORS_ORIGINS` env var on the Render service.)

## 4. Keep it fast (minimize cold starts)

Render's free backend sleeps after ~15 min idle (the next request then takes ~30–50s).
To keep it warm, in GitHub go to **Settings → Secrets and variables → Actions → New
repository secret**:
- `BACKEND_URL` = your Render URL (e.g. `https://constructai-api.onrender.com`)

The included workflow [`.github/workflows/keep-warm.yml`](.github/workflows/keep-warm.yml)
then pings `/health` every ~10 min. (A free https://uptimerobot.com monitor at 5-min
intervals is even more reliable.)

> **Truly zero delay** needs an always-on instance — upgrade the Render service to the
> Starter plan (~$7/mo) and it never sleeps. The Vercel frontend is always instant.

## 5. AI provider (optional)

The AI features (Ask ConstructAI, Budget, AI draft orders, photo vision) run on a built-in
**rule-based fallback** by default — zero setup, zero cost — and the dashboard shows a
**"Live AI" / "Demo"** badge. To switch to a real model, set `AI_PROVIDER` plus its settings:

- **Free & local — Ollama** *(best for development / self-hosting; no API bill)*: install
  [Ollama](https://ollama.com), then `ollama pull llama3.1` and `ollama pull llama3.2-vision`,
  and run the backend with `AI_PROVIDER=ollama`. No key, no per-call cost. ⚠️ Ollama needs real
  RAM/GPU, so it **can't run on Render's free tier** — use it locally, or self-host the backend
  on a machine that runs Ollama.
- **Free & hosted — Google Gemini** *(best for the live Render demo)*: grab a free key at
  [aistudio.google.com](https://aistudio.google.com), then on the Render service set
  `AI_PROVIDER=gemini` and `GEMINI_API_KEY=...` (optionally `GEMINI_MODEL`) → redeploy. It's a
  free, rate-limited tier (no card) and **multimodal — so photo analysis works too**. This is
  the only way to get real AI (incl. vision) on the **hosted** site without paying.
- **Paid / hosted — Claude, OpenAI, Groq, OpenRouter…** *(works on Render)*: set
  `AI_PROVIDER=anthropic` + `ANTHROPIC_API_KEY`, **or** `AI_PROVIDER=openai` + `OPENAI_API_KEY`
  (add `OPENAI_BASE_URL` to point at any OpenAI-compatible host). Add them under the service's
  **Environment** tab → redeploy.

Every variable is documented in [`backend/.env.example`](backend/.env.example). Any provider
error (bad key, model offline, malformed output) **silently degrades to the rule-based fallback**.

## 6. Field app (mobile PWA) — optional

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

The deploy seeds demo data automatically into an empty database: **5 industries, 6 sites,
every role**. Logins (password `password123`): `manager@`, `stock@`, `engineer@`,
`vendor1@constructai.dev`. To reset the live demo to pristine, open the Render service
**Shell** and run `python -m app.seed --reset`.

You can also seed a Neon database straight from your own machine — set `DATABASE_URL` to
the Neon connection string and run `alembic upgrade head` then `python -m app.seed`.
