"""Deterministic, rule-based answers for when no Claude key is configured.

Intent-routes the question against the live context so the public demo still
gives data-grounded answers (and so the test suite needs no API key).
"""
from __future__ import annotations

from sqlalchemy.orm import Session

from ...config import settings
from ...models import Site
from . import context


def _money(n: float) -> str:
    return "₹" + f"{round(float(n)):,}"


def _num(n: float) -> str:
    n = round(float(n), 2)
    return str(int(n)) if n == int(n) else str(n)


def _order_answer(ctx: dict) -> tuple[str, list[dict]]:
    vops = ctx["vendor_options"]["materials"]
    rain = ctx["weather"].get("will_rain")
    if not vops:
        return ("All stock is healthy right now — nothing needs reordering.", [{"label": "Stock levels"}])
    lines = []
    for m in vops[:4]:
        best = m["offers"][0] if m["offers"] else None
        if best:
            lines.append(
                f"{m['material']} ({m['status']}, order ~{_num(m['shortfall'])} {m['unit']}) "
                f"→ best: {best['vendor']} at ₹{_num(best['price_per_unit'])}/{m['unit']}, {best['eta_days']}d"
            )
        else:
            lines.append(f"{m['material']} ({m['status']}) — no active vendor offers")
    tail = " Rain is forecast, so weather-sensitive items get a +20% buffer." if rain else ""
    answer = f"{len(vops)} material(s) need reordering. " + " · ".join(lines) + "." + tail
    sources = [{"label": "Stock levels"}, {"label": "Vendor offers"}]
    if rain:
        sources.append({"label": "Weather"})
    return answer, sources


def _usage_answer(ctx: dict) -> tuple[str, list[dict]]:
    mats = ctx["usage_trends"]["materials"]
    if not mats:
        return ("No consumption recorded in the last two weeks.", [{"label": "Usage analytics"}])
    spiked = [m for m in mats if m["spikes"]]
    if spiked:
        m = spiked[0]
        s = m["spikes"][0]
        answer = (
            f"{m['material']} consumption spiked on {s['date']} — {_num(s['amount'])} {m['unit']} "
            f"vs a {_num(m['avg_daily'])}/{m['unit']}-per-day norm. That's well above trend; "
            f"worth checking for waste or theft."
        )
    else:
        m = mats[0]
        answer = (
            f"No unusual spikes in the last 14 days. {m['material']} is the top consumer at "
            f"{_num(m['avg_daily'])} {m['unit']}/day ({_num(m['total_consumed'])} total)."
        )
    return answer, [{"label": "Usage analytics"}]


def _budget_answer(ctx: dict) -> tuple[str, list[dict]]:
    s = ctx["spend_summary"]
    answer = (
        f"Spent so far: {_money(s['material_delivered'])} on delivered materials, "
        f"{_money(s['material_committed'])} committed in open orders, and "
        f"{_money(s['labour_spend'])} on labour ({s['worker_days']} worker-days × "
        f"{_money(s['labor_rate'])}). Open the Budget panel for the full forecast vs the AI budget."
    )
    return answer, [{"label": "Budget & spend"}, {"label": "Purchase orders"}]


def _weather_answer(ctx: dict) -> tuple[str, list[dict]]:
    w = ctx["weather"]
    sensitive = [m["material"] for m in ctx["stock_health"]["materials"] if m["weather_sensitive"]]
    if w.get("will_rain"):
        s = f" A +20% buffer applies to weather-sensitive materials ({', '.join(sensitive)})." if sensitive else ""
        answer = f"Rain is expected in {w['city']} ({w['condition']}).{s} Consider ordering those ahead of the rain."
    else:
        answer = f"No rain in the {w['city']} forecast ({w['condition']}) — no weather buffer needed right now."
    return answer, [{"label": "Weather"}]


def _progress_answer(ctx: dict) -> tuple[str, list[dict]]:
    p = ctx["site_progress"]
    if p["latest_progress"] is None:
        return ("No engineer daily updates yet, so progress can't be assessed.", [{"label": "Site progress"}])
    issues = "; ".join(i for i in p["open_issues"] if i)
    issue_txt = f" Open blockers: {issues}." if issues else " No open blockers reported."
    answer = (
        f"Latest update: {_num(p['latest_progress'])}% complete with ~{p['avg_labor']} workers on site."
        + issue_txt
    )
    return answer, [{"label": "Site progress"}]


def _overview_answer(ctx: dict) -> tuple[str, list[dict]]:
    c = ctx["stock_health"]["counts"]
    p = ctx["site_progress"]
    w = ctx["weather"]
    prog = f"{_num(p['latest_progress'])}% complete" if p["latest_progress"] is not None else "no progress logged"
    rain = "rain expected" if w.get("will_rain") else "clear weather"
    answer = (
        f"{ctx['stock_health']['site']}: {c.get('critical', 0)} critical / {c.get('low', 0)} low "
        f"of {sum(c.values())} materials, {prog}, {rain} in {w.get('city')}. "
        f"Ask about ordering, usage spikes, the budget, weather, or progress for detail."
    )
    return answer, [{"label": "Stock levels"}, {"label": "Site progress"}, {"label": "Weather"}]


def fallback_ask(db: Session, site: Site) -> dict:
    return context.full_context(db, site, settings.labor_rate_per_worker_day)


def answer(db: Session, site: Site, question: str) -> dict:
    """Route a question to a grounded, rule-based answer."""
    ctx = context.full_context(db, site, settings.labor_rate_per_worker_day)
    q = (question or "").lower()

    def has(*words: str) -> bool:
        return any(w in q for w in words)

    if has("order", "buy", "purchase", "procure", "reorder", "restock", "supplier", "vendor"):
        text, sources = _order_answer(ctx)
    elif has("spike", "why", "jump", "surge", "unusual", "theft", "waste", "consum", "usage", "used"):
        text, sources = _usage_answer(ctx)
    elif has("budget", "cost", "spend", "spent", "money", "expensive", "afford", "over"):
        text, sources = _budget_answer(ctx)
    elif has("weather", "rain", "storm", "monsoon"):
        text, sources = _weather_answer(ctx)
    elif has("progress", "schedule", "behind", "delay", "labour", "labor", "worker", "manpower", "track"):
        text, sources = _progress_answer(ctx)
    else:
        text, sources = _overview_answer(ctx)

    return {"answer": text, "sources": sources, "used_ai": False}
