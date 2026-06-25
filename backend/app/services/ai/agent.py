"""The natural-language insights agent.

When Claude is configured it runs a manual tool-use loop: the model fetches the
slices of live site data it needs (stock, usage, vendors, weather, progress,
orders, spend) and answers grounded in them. With no key it degrades to the
deterministic rule-based answer.
"""
from __future__ import annotations

from sqlalchemy.orm import Session

from ...config import settings
from ...models import Site
from . import fallback
from .client import get_client
from .tools import SOURCE_LABELS, TOOLS, run_tool

_MAX_ITERS = 6

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
    client = get_client()
    if client is None:
        return fallback.answer(db, site, question)
    try:
        return _agent_loop(client, db, site, question)
    except Exception:
        # Any API/key/network error degrades gracefully to the rule-based answer.
        return fallback.answer(db, site, question)


def _agent_loop(client, db: Session, site: Site, question: str) -> dict:
    labor_rate = settings.labor_rate_per_worker_day
    brief = f"Site: {site.name}" + (f" in {site.city}" if site.city else "")
    messages = [{"role": "user", "content": f"{brief}.\n\nManager's question: {question}"}]
    used_tools: list[str] = []

    for _ in range(_MAX_ITERS):
        response = client.messages.create(
            model=settings.ai_model,
            max_tokens=1024,
            system=_SYSTEM,
            tools=TOOLS,
            thinking={"type": "adaptive"},
            output_config={"effort": "medium"},
            messages=messages,
        )

        if response.stop_reason != "tool_use":
            text = "".join(b.text for b in response.content if b.type == "text").strip()
            return {
                "answer": text or "I couldn't find enough data to answer that.",
                "sources": _sources(used_tools),
                "used_ai": True,
            }

        # Preserve the full assistant turn (thinking + tool_use), then answer the calls.
        messages.append({"role": "assistant", "content": response.content})
        tool_results = []
        for block in response.content:
            if block.type == "tool_use":
                used_tools.append(block.name)
                tool_results.append(
                    {
                        "type": "tool_result",
                        "tool_use_id": block.id,
                        "content": run_tool(db, site, block.name, labor_rate),
                    }
                )
        messages.append({"role": "user", "content": tool_results})

    # Hit the iteration cap — fall back rather than loop forever.
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
