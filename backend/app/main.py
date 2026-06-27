"""ConstructAI API entrypoint."""
from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .routers import (
    ai,
    auth,
    engineering,
    industries,
    materials,
    portfolio,
    procurement,
    schedule,
    sites,
    stock,
    vendors,
    weather,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Schema is managed by Alembic migrations (`alembic upgrade head`) — not
    # auto-created here, so the app never silently drifts from the migrations.
    yield


app = FastAPI(
    title="ConstructAI API",
    description="Material procurement platform — stock, vendors, and auto-reorder.",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_origin_regex=settings.cors_origin_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(industries.router)
app.include_router(sites.router)
app.include_router(materials.router)
app.include_router(stock.router)
app.include_router(vendors.router)
app.include_router(procurement.router)
app.include_router(weather.router)
app.include_router(engineering.router)
app.include_router(ai.router)
app.include_router(schedule.router)
app.include_router(portfolio.router)


@app.get("/", tags=["health"])
def root() -> dict:
    return {"app": settings.app_name, "status": "ok", "docs": "/docs"}


@app.get("/health", tags=["health"])
def health() -> dict:
    return {"status": "healthy"}
