"""Back-compat shim. The active LLM provider (Anthropic / OpenAI / Ollama, or
None for the rule-based fallback) now lives in `provider.py`."""
from __future__ import annotations

from .provider import ai_enabled, get_provider

__all__ = ["ai_enabled", "get_provider"]
