"""Application configuration, loaded from environment / .env file."""
from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "ConstructAI"
    # Auth — dev default is intentionally long (>=32 bytes for HS256). Override in prod.
    secret_key: str = "dev-only-insecure-secret-change-me-in-production-0123456789"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24  # 1 day

    # Database (SQLite by default for zero-setup local dev)
    database_url: str = "sqlite:///./constructai.db"

    # CORS – comma-separated list of allowed frontend origins
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


settings = Settings()
