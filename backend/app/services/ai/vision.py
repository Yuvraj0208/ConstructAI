"""Site-photo vision analysis.

Sends an uploaded site photo to Claude vision and returns a structured progress &
safety report. With no key configured it returns a clear "pending" placeholder —
there's no rule-based way to analyse an image, so the photo is still stored and
shown, and real analysis switches on the moment a key is added.
"""
from __future__ import annotations

import logging

from .provider import get_provider

_log = logging.getLogger("constructai.ai")

_VISION_SCHEMA = {
    "type": "object",
    "properties": {
        "progress_estimate": {
            "type": "number",
            "description": "Estimated construction completion shown in the photo, 0-100.",
        },
        "summary": {"type": "string", "description": "One impactful sentence for the manager, leading with what matters most (milestone, risk or safety) — the 'so what', not a description."},
        "observations": {"type": "array", "items": {"type": "string"}},
        "safety_flags": {
            "type": "array",
            "items": {"type": "string"},
            "description": "Visible safety issues / missing PPE / hazards. Empty if none.",
        },
        "materials_visible": {"type": "array", "items": {"type": "string"}},
        "status": {"type": "string", "enum": ["on_track", "needs_attention", "blocked"]},
    },
    "required": [
        "progress_estimate",
        "summary",
        "observations",
        "safety_flags",
        "materials_visible",
        "status",
    ],
    "additionalProperties": False,
}

_PROMPT = (
    "You are a senior site supervisor briefing a busy PROJECT MANAGER who will read this for "
    "five seconds. Look at the photo and report only what helps them run the project.\n\n"
    "Fields:\n"
    "- progress_estimate: completion of the visible work (0-100).\n"
    "- summary: ONE punchy sentence (max 25 words) leading with the single most important thing "
    "for the manager — a milestone reached, a delay or quality risk, or a safety issue. Give the "
    "'so what', not a plain description of what is in the frame.\n"
    "- observations: up to 3 short, concrete points worth attention (pace vs progress, "
    "workmanship, anything off). Each under 12 words. No filler.\n"
    "- safety_flags: visible hazards or missing PPE the manager is accountable for (no edge "
    "protection, no helmets/harnesses, unsafe scaffolding or access). Empty list if none.\n"
    "- materials_visible: construction materials you can identify on site.\n"
    "- status: on_track, needs_attention (a risk to manage now), or blocked (work cannot proceed).\n\n"
    "Be specific, decisive and practical. If the image is unclear or not a construction site, say "
    "so in summary and use needs_attention. Reply with ONLY minified JSON — no markdown, no code fences."
)


def _fallback_report() -> dict:
    return {
        "progress_estimate": None,
        "summary": "Photo received. Configure an AI provider (a local Ollama vision model, "
        "or an API key) for an automatic progress and safety assessment.",
        "observations": [],
        "safety_flags": [],
        "materials_visible": [],
        "status": "pending",
        "used_ai": False,
    }


def _ai_vision(provider, image_bytes: bytes, media_type: str) -> dict:
    data = provider.complete_vision_json(
        system="You are a construction site supervisor.",
        user_text=_PROMPT,
        image_bytes=image_bytes,
        media_type=media_type,
        schema=_VISION_SCHEMA,
    )
    # A small model may just describe the image (no JSON). That's fine — the
    # description becomes the summary. Only treat a truly empty reply as a failure.
    summary = str(data.get("summary") or "").strip()
    if not summary:
        raise ValueError("vision model returned an empty response")
    pe = data.get("progress_estimate")
    return {
        "progress_estimate": max(0.0, min(100.0, float(pe))) if pe is not None else None,
        "summary": summary,
        "observations": [str(x) for x in data.get("observations", [])],
        "safety_flags": [str(x) for x in data.get("safety_flags", [])],
        "materials_visible": [str(x) for x in data.get("materials_visible", [])],
        "status": str(data.get("status") or "needs_attention"),
        "used_ai": True,
    }


def analyze_site_image(image_bytes: bytes, media_type: str) -> dict:
    """Return a structured report dict. Never raises — degrades to a placeholder."""
    provider = get_provider()
    if provider is None:
        return _fallback_report()
    try:
        return _ai_vision(provider, image_bytes, media_type)
    except Exception as e:
        _log.warning("Vision analysis failed (%s); saving the placeholder report", e)
        return _fallback_report()
