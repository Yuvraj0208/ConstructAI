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

## Demo data

The deploy seeds demo data automatically: **5 industries, 6 sites, every role**. Logins
(password `password123`): `manager@`, `stock@`, `engineer@`, `vendor1@constructai.dev`.
To reset the live demo to pristine, open the Render service **Shell** and run:
`python -m app.seed --reset`.
