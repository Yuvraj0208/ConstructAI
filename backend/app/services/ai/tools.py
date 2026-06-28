"""Claude tool definitions for the insights agent + a dispatcher that runs them
against the live DB. Most tools take no inputs (the site is bound server-side);
`search_site_notes` takes a free-text query for keyword retrieval."""
from __future__ import annotations

import json

from sqlalchemy.orm import Session

from ...models import Site
from . import context, notes

_NO_ARGS = {"type": "object", "properties": {}, "required": []}
_QUERY_ARGS = {
    "type": "object",
    "properties": {"query": {"type": "string", "description": "keywords to search for"}},
    "required": ["query"],
}

# (tool name, friendly source label, description, input schema)
_TOOLSPEC = [
    ("get_stock_health", "Stock levels", "Current stock for every material on the site: on-hand, available, reserved, threshold, target and ok/low/critical status.", _NO_ARGS),
    ("get_usage_trends", "Usage analytics", "Recent daily consumption per material with spike detection — use this to explain why a material's usage jumped.", _NO_ARGS),
    ("get_vendor_options", "Vendor offers", "For each low/critical material, the best-ranked vendor offers (price, ETA, availability) — use this to recommend what and where to order.", _NO_ARGS),
    ("get_weather", "Weather", "The site city's short-range forecast, including whether rain is expected (which adds a buffer to weather-sensitive materials).", _NO_ARGS),
    ("get_site_progress", "Site progress", "Latest engineer daily updates: completion %, workers on site, and open issues/blockers.", _NO_ARGS),
    ("get_open_orders", "Purchase orders", "Purchase orders that are suggested/approved/in-transit and not yet delivered.", _NO_ARGS),
    ("get_budget_status", "Budget & spend", "Money committed and spent so far: delivered + committed material POs and labour spend (worker-days × rate).", _NO_ARGS),
    ("get_schedule", "Schedule", "Project milestones with target dates, days remaining, which are overdue/at-risk, and the latest reported progress %.", _NO_ARGS),
    ("search_site_notes", "Field notes", "Keyword-search the site's free-text history (daily updates, material requests, PO rationales, stock notes, photo reports) to recall what happened — e.g. why a material's usage changed.", _QUERY_ARGS),
]

# Provider-neutral tool specs: {name, description, parameters(JSON schema)}.
# Each provider maps these to its own tool format (Anthropic input_schema /
# OpenAI function.parameters).
TOOLS_SPEC = [{"name": name, "description": desc, "parameters": schema} for name, _l, desc, schema in _TOOLSPEC]

SOURCE_LABELS = {name: label for name, label, _desc, _schema in _TOOLSPEC}


def run_tool(db: Session, site: Site, name: str, tool_input: dict | None, labor_rate: float) -> str:
    """Execute a tool by name and return its result as a JSON string."""
    ti = tool_input or {}
    if name == "get_stock_health":
        result = context.stock_health(db, site)
    elif name == "get_usage_trends":
        result = context.usage_trends(db, site)
    elif name == "get_vendor_options":
        result = context.vendor_options(db, site)
    elif name == "get_weather":
        result = context.weather(site)
    elif name == "get_site_progress":
        result = context.site_progress(db, site)
    elif name == "get_open_orders":
        result = context.open_orders(db, site)
    elif name == "get_budget_status":
        result = context.spend_summary(db, site, labor_rate)
    elif name == "get_schedule":
        result = context.schedule(db, site)
    elif name == "search_site_notes":
        q = str(ti.get("query", ""))
        result = {"query": q, "hits": notes.search_notes(db, site, q)}
    else:
        result = {"error": f"unknown tool: {name}"}
    return json.dumps(result, default=str)
