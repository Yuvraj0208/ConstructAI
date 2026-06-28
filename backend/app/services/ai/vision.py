"""Site-photo vision analysis.

Sends an uploaded site photo to Claude vision and returns a structured progress &
safety report. With no key configured it returns a clear "pending" placeholder —
there's no rule-based way to analyse an image, so the photo is still stored and
shown, and real analysis switches on the moment a key is added.
"""
from __future__ import annotations

from .provider import get_provider

_VISION_SCHEMA = {
    "type": "object",
    "properties": {
        "progress_estimate": {
            "type": "number",
            "description": "Estimated construction completion shown in the photo, 0-100.",
        },
        "summary": {"type": "string", "description": "One line for the project manager."},
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
    "You are a construction site supervisor reviewing a progress photo for the project "
    "manager. Analyse the image and report: an estimated completion percentage, a concise "
    "one-line summary, key observations, any visible safety issues (missing PPE, hazards — "
    "leave empty if none), the construction materials you can see, and an overall status "
    "(on_track, needs_attention, or blocked). Be specific and practical; if the image is "
    "unclear or not a construction site, say so in the summary and use needs_attention."
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
    pe = data.get("progress_estimate")
    return {
        "progress_estimate": max(0.0, min(100.0, float(pe))) if pe is not None else None,
        "summary": str(data.get("summary") or ""),
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
    except Exception:
        return _fallback_report()
