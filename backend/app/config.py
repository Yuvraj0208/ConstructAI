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

    # ----- AI layer (optional) -----
    # Pick the LLM provider. When none is configured, every AI feature falls back
    # to a deterministic rule-based engine, so the app works with zero setup/cost.
    #   AI_PROVIDER = "" (auto from keys / fallback) | "anthropic" | "openai" | "ollama"
    ai_provider: str = ""

    # Anthropic (Claude)
    anthropic_api_key: str | None = None
    ai_model: str = "claude-opus-4-8"

    # OpenAI-compatible — works for OpenAI, Groq, OpenRouter, Gemini's compat
    # endpoint, etc. Set OPENAI_BASE_URL to point at a different host.
    openai_api_key: str | None = None
    openai_base_url: str | None = None
    openai_model: str = "gpt-4o"
    openai_vision_model: str = "gpt-4o"

    # Google Gemini — has a genuinely FREE tier (rate-limited, no card) and is
    # multimodal, so it works on hosted servers (Render). Set AI_PROVIDER=gemini
    # and just GEMINI_API_KEY (from https://aistudio.google.com). Uses Gemini's
    # OpenAI-compatible endpoint under the hood.
    gemini_api_key: str | None = None
    gemini_model: str = "gemini-2.0-flash"

    # Ollama — a LOCAL, free, OpenAI-compatible server (runs on your own machine,
    # no API key, no per-call cost). Pull a tool-capable model + a vision model.
    ollama_base_url: str = "http://localhost:11434/v1"
    ollama_model: str = "llama3.1"
    ollama_vision_model: str = "llama3.2-vision"

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
