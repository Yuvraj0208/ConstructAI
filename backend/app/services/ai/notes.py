"""Keyword retrieval over a site's free-text notes — daily updates, material
requests, purchase-order rationales, stock-movement notes and photo reports.

This is the "RAG" retrieval layer, done lexically (TF×IDF over the site's own
corpus) so it needs no embeddings provider and no API key. It both backs a search
endpoint and gives the insights agent a `search_site_notes` tool.
"""
from __future__ import annotations

import json
import math
import re
from collections import Counter
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from ...models import (
    DailyUpdate,
    Material,
    MaterialRequest,
    PurchaseOrder,
    Site,
    SiteImageReport,
    StockMovement,
)

_TOKEN = re.compile(r"[a-z0-9]+")
_STOPWORDS = {
    "the", "and", "for", "are", "was", "were", "has", "had", "have", "with", "that", "this",
    "from", "into", "out", "off", "but", "not", "you", "your", "our", "their", "its", "they",
    "them", "she", "him", "her", "his", "all", "any", "can", "will", "did", "does", "done",
    "due", "per", "via", "why", "how", "what", "when", "who", "which", "where", "been", "being",
    "about", "over", "under", "than", "then", "there", "here", "some", "more", "most", "much",
}


def _tok(text: str | None) -> list[str]:
    return [t for t in _TOKEN.findall((text or "").lower()) if len(t) > 2 and t not in _STOPWORDS]


def _as_date(dt: datetime | None) -> str | None:
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.date().isoformat()


def gather_notes(db: Session, site: Site) -> list[dict]:
    """Every free-text note attached to a site, newest-first-ish, as {source, text, date}."""
    notes: list[dict] = []
    mat_ids = [m.id for m in db.scalars(select(Material).where(Material.site_id == site.id)).all()]

    for u in db.scalars(
        select(DailyUpdate)
        .where(DailyUpdate.site_id == site.id)
        .order_by(DailyUpdate.created_at.desc())
        .limit(60)
    ).all():
        parts = [u.summary]
        if u.issues:
            parts.append(f"Issue: {u.issues}")
        if u.weather_impact:
            parts.append(f"Weather: {u.weather_impact}")
        notes.append(
            {"source": "Daily update", "text": " ".join(p for p in parts if p), "date": _as_date(u.created_at)}
        )

    for r in db.scalars(
        select(MaterialRequest)
        .where(MaterialRequest.site_id == site.id)
        .order_by(MaterialRequest.created_at.desc())
        .limit(60)
    ).all():
        text = " ".join(p for p in [r.needed_for, r.note] if p)
        if text:
            notes.append({"source": "Material request", "text": text, "date": _as_date(r.created_at)})

    if mat_ids:
        for po in db.scalars(
            select(PurchaseOrder)
            .where(PurchaseOrder.material_id.in_(mat_ids), PurchaseOrder.rationale.isnot(None))
            .order_by(PurchaseOrder.created_at.desc())
            .limit(80)
        ).all():
            if po.rationale:
                notes.append({"source": "Purchase order", "text": po.rationale, "date": _as_date(po.created_at)})

        for mv in db.scalars(
            select(StockMovement)
            .where(StockMovement.material_id.in_(mat_ids), StockMovement.note.isnot(None))
            .order_by(StockMovement.created_at.desc())
            .limit(120)
        ).all():
            if mv.note:
                notes.append({"source": "Stock movement", "text": mv.note, "date": _as_date(mv.created_at)})

    for img in db.scalars(
        select(SiteImageReport)
        .where(SiteImageReport.site_id == site.id)
        .order_by(SiteImageReport.created_at.desc())
        .limit(40)
    ).all():
        try:
            obs = json.loads(img.observations or "[]")
        except Exception:
            obs = []
        text = " ".join([img.summary, *[str(o) for o in obs]]).strip()
        if text:
            notes.append({"source": "Site photo", "text": text, "date": _as_date(img.created_at)})

    return notes


def search_notes(db: Session, site: Site, query: str, k: int = 5) -> list[dict]:
    """Top-k notes by keyword relevance (TF × IDF over the site corpus)."""
    docs = gather_notes(db, site)
    q_terms = set(_tok(query))
    if not docs or not q_terms:
        return []

    tokenized = [Counter(_tok(d["text"])) for d in docs]
    n = len(docs)
    df = {t: sum(1 for tc in tokenized if t in tc) for t in q_terms}

    scored: list[tuple[float, dict]] = []
    for d, tc in zip(docs, tokenized):
        score = 0.0
        for t in q_terms:
            if t in tc:
                idf = math.log((n + 1) / (df[t] + 1)) + 1.0
                score += tc[t] * idf
        if score > 0:
            scored.append((score, d))

    scored.sort(key=lambda x: x[0], reverse=True)
    hits = []
    for score, d in scored[:k]:
        text = d["text"]
        snippet = text if len(text) <= 200 else text[:197] + "…"
        hits.append({"source": d["source"], "text": snippet, "date": d["date"], "score": round(score, 3)})
    return hits
