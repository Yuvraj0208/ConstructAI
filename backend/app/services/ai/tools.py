"""Claude tool definitions for the insights agent + a dispatcher that runs them
against the live DB. The site is bound server-side, so the tools take no inputs —
the model just decides *which* slices of live data it needs to answer."""
from __future__ import annotations

import json

from sqlalchemy.orm import Session

from ...models import Site
from . import context

_NO_ARGS = {"type": "object", "properties": {}, "required": []}

# (tool name, friendly source label, description)
_TOOLSPEC = [
    ("get_stock_health", "Stock levels", "Current stock for every material on the site: on-hand, available, reserved, threshold, target and ok/low/critical status."),
    ("get_usage_trends", "Usage analytics", "Recent daily consumption per material with spike detection — use this to explain why a material's usage jumped."),
    ("get_vendor_options", "Vendor offers", "For each low/critical material, the best-ranked vendor offers (price, ETA, availability) — use this to recommend what and where to order."),
    ("get_weather", "Weather", "The site city's short-range forecast, including whether rain is expected (which adds a buffer to weather-sensitive materials)."),
    ("get_site_progress", "Site progress", "Latest engineer daily updates: completion %, workers on site, and open issues/blockers."),
    ("get_open_orders", "Purchase orders", "Purchase orders that are suggested/approved/in-transit and not yet delivered."),
    ("get_budget_status", "Budget & spend", "Money committed and spent so far: delivered + committed material POs and labour spend (worker-days × rate)."),
]

# Claude tool schemas
TOOLS = [
    {"name": name, "description": desc, "input_schema": _NO_ARGS}
    for name, _label, desc in _TOOLSPEC
]

SOURCE_LABELS = {name: label for name, label, _desc in _TOOLSPEC}


def run_tool(db: Session, site: Site, name: str, labor_rate: float) -> str:
    """Execute a tool by name and return its result as a JSON string."""
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
    else:
        result = {"error": f"unknown tool: {name}"}
    return json.dumps(result, default=str)
