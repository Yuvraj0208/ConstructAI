"""Anthropic client factory. Returns None when no API key is configured, which
flips the whole AI layer into its deterministic rule-based fallback."""
from __future__ import annotations

from typing import Any

from ...config import settings

_client: Any = None


def ai_enabled() -> bool:
    """True when a real Claude API key is configured."""
    return bool(settings.anthropic_api_key)


def get_client() -> Any:
    """A cached Anthropic client, or None when no key is set.

    `anthropic` is imported lazily so the dependency stays optional — the app
    (and its tests) run fine without it as long as no key is configured.
    """
    global _client
    if not ai_enabled():
        return None
    if _client is None:
        import anthropic  # lazy import

        _client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
    return _client
