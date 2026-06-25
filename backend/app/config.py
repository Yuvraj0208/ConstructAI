"""Application configuration, loaded from environment / .env file."""
from __future__ import annotations

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "ConstructAI"
    # Auth — dev default is intentionally long (>=32 bytes for HS256). Override in prod.
    secret_key: str = "dev-only-insecure-secret-change-me-in-production-0123456789"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24  # 1 day

    # AI layer (optional). When ANTHROPIC_API_KEY is unset, the AI endpoints fall
    # back to a deterministic rule-based engine so the live demo keeps working.
    anthropic_api_key: str | None = None
    ai_model: str = "claude-opus-4-8"
    # Default labour cost per worker-day (₹) used for budget & spend estimates.
    labor_rate_per_worker_day: float = 1200.0

    # Database (SQLite by default for zero-setup local dev)
    database_url: str = "sqlite:///./constructai.db"

    # CORS – comma-separated list of allowed frontend origins
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"
    # Optional regex to allow dynamic origins (e.g. Vercel preview deployments):
    #   CORS_ORIGIN_REGEX=https://.*\.vercel\.app
    cors_origin_regex: str | None = None

    @model_validator(mode="after")
    def _normalize_database_url(self) -> "Settings":
        """Managed Postgres (Render/Heroku) hands out `postgres://` / `postgresql://`;
        rewrite to the psycopg driver SQLAlchemy expects."""
        url = self.database_url
        if url.startswith("postgres://"):
            url = "postgresql+psycopg://" + url[len("postgres://") :]
        elif url.startswith("postgresql://"):
            url = "postgresql+psycopg://" + url[len("postgresql://") :]
        self.database_url = url
        return self

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


settings = Settings()
