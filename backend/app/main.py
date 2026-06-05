"""ConstructAI API entrypoint."""
from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .database import Base, engine
from .routers import auth, industries, materials, procurement, stock, vendors, weather


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create tables on startup. For schema changes during early dev, delete the
    # SQLite file and reseed (we'll switch to Alembic migrations later).
    Base.metadata.create_all(bind=engine)
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
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(industries.router)
app.include_router(materials.router)
app.include_router(stock.router)
app.include_router(vendors.router)
app.include_router(procurement.router)
app.include_router(weather.router)


@app.get("/", tags=["health"])
def root() -> dict:
    return {"app": settings.app_name, "status": "ok", "docs": "/docs"}


@app.get("/health", tags=["health"])
def health() -> dict:
    return {"status": "healthy"}
