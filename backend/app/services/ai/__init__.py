"""ConstructAI's AI layer.

A thin agentic layer over the live procurement data. When an ANTHROPIC_API_KEY is
configured it uses Claude (tool-calling for insights, structured output for the
budget); otherwise every entry point degrades to a deterministic, rule-based
engine computed from the *same* context builders, so the demo always works.
"""
from __future__ import annotations

from .agent import ask
from .budget import build_forecast, propose_budget
from .client import ai_enabled
from .vision import analyze_site_image

__all__ = ["ask", "propose_budget", "build_forecast", "ai_enabled", "analyze_site_image"]
