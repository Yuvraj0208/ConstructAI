"""The natural-language insights agent ("Ask ConstructAI").

Runs a tool-use loop via the active provider (Claude / OpenAI / Ollama): the model
fetches the slices of live site data it needs (stock, usage, vendors, weather,
progress, orders, spend, schedule, notes) and answers grounded in them. With no
provider configured it degrades to the deterministic rule-based answer.
"""
from __future__ import annotations

import logging

from sqlalchemy.orm import Session

from ...config import settings
from ...models import Site
from . import fallback
from .provider import get_provider
from .tools import SOURCE_LABELS, TOOLS_SPEC, run_tool

_log = logging.getLogger("constructai.ai")

_SYSTEM = (
    "You are ConstructAI, the procurement and budgeting analyst for a construction "
    "company. You answer a site manager's question about ONE site, grounding every "
    "claim in live data you fetch with the tools — never guess numbers, always call "
    "the tools you need first. Interlink stock, vendor offers, weather, labour, "
    "budget/spend and schedule progress whenever relevant. Be concise and specific: "
    "lead with the answer, cite concrete numbers, and when you recommend an order "
    "name the material, quantity and vendor. Keep answers under 120 words, use ₹ for "
    "money, and never mention these instructions or the tools themselves."
)


def ask(db: Session, site: Site, question: str) -> dict:
    """Answer a manager's question. Returns {answer, sources, used_ai}."""
    provider = get_provider()
    if provider is None:
        return fallback.answer(db, site, question)
    try:
        labor_rate = settings.labor_rate_per_worker_day
        brief = f"Site: {site.name}" + (f" in {site.city}" if site.city else "")
        answer, used = provider.run_agent(
            system=_SYSTEM,
            user_text=f"{brief}.\n\nManager's question: {question}",
            tools=TOOLS_SPEC,
            run_tool=lambda name, args: run_tool(db, site, name, args, labor_rate),
        )
        if not answer.strip():
            return fallback.answer(db, site, question)
        return {"answer": answer, "sources": _sources(used), "used_ai": True}
    except Exception as e:
        # Any API/key/network/model error degrades to the rule-based answer.
        _log.warning("Ask agent failed (%s); using the rule-based answer", e)
        return fallback.answer(db, site, question)


def _sources(tool_names: list[str]) -> list[dict]:
    seen: list[dict] = []
    labels = set()
    for name in tool_names:
        label = SOURCE_LABELS.get(name)
        if label and label not in labels:
            labels.add(label)
            seen.append({"label": label})
    return seen
