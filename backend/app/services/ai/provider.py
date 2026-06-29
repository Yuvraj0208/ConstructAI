"""Pluggable LLM provider for the AI layer.

Selected via ``AI_PROVIDER`` (or auto-detected from configured keys):

  - ``anthropic``     → Claude via the ``anthropic`` SDK
  - ``openai``        → OpenAI, or any OpenAI-compatible host via ``OPENAI_BASE_URL``
                        (Groq, OpenRouter, Gemini's compat endpoint, …)
  - ``ollama``        → a LOCAL Ollama server (OpenAI-compatible, free, no key)
  - unset / no key    → ``None`` — the whole AI layer uses its rule-based fallback

Every caller wraps these in ``try/except`` → fallback, so a missing server, a
model that can't do tools, or malformed JSON never breaks a request.

Each provider implements three operations the features need:
  - ``run_agent``            — a tool-use loop (powers "Ask ConstructAI")
  - ``complete_json``        — structured JSON output (budgeting, draft orders)
  - ``complete_vision_json`` — image in, structured JSON out (photo analysis)
"""
from __future__ import annotations

import base64
import json
import re
from typing import Any, Callable

from ...config import settings

ToolSpec = dict  # provider-neutral: {name, description, parameters(JSON schema)}
RunTool = Callable[[str, dict], str]


def _lenient_json(text: str) -> dict:
    """Best-effort JSON from a model reply. If the model didn't return JSON, use
    its raw text as a 'summary' — so even a small model that merely describes an
    image still yields a usable result instead of being thrown away."""
    text = (text or "").strip()
    if not text:
        return {}
    try:
        return json.loads(text)
    except Exception:
        pass
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(0))
        except Exception:
            pass
    return {"summary": text}


class _AnthropicProvider:
    def __init__(self) -> None:
        import anthropic

        self._client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
        self.model = settings.ai_model

    def run_agent(self, system, user_text, tools, run_tool, max_iters=6):
        atools = [
            {"name": t["name"], "description": t["description"], "input_schema": t["parameters"]}
            for t in tools
        ]
        messages: list[Any] = [{"role": "user", "content": user_text}]
        used: list[str] = []
        for _ in range(max_iters):
            resp = self._client.messages.create(
                model=self.model,
                max_tokens=1024,
                system=system,
                tools=atools,
                thinking={"type": "adaptive"},
                output_config={"effort": "medium"},
                messages=messages,
            )
            if resp.stop_reason != "tool_use":
                return "".join(b.text for b in resp.content if b.type == "text").strip(), used
            messages.append({"role": "assistant", "content": resp.content})
            results = []
            for b in resp.content:
                if b.type == "tool_use":
                    used.append(b.name)
                    results.append(
                        {"type": "tool_result", "tool_use_id": b.id, "content": run_tool(b.name, b.input)}
                    )
            messages.append({"role": "user", "content": results})
        return "", used

    def complete_json(self, system, user_text, schema):
        resp = self._client.messages.create(
            model=self.model,
            max_tokens=1500,
            system=system,
            messages=[{"role": "user", "content": user_text}],
            output_config={"format": {"type": "json_schema", "schema": schema}},
        )
        text = next((b.text for b in resp.content if b.type == "text"), "")
        return json.loads(text)

    def complete_vision_json(self, system, user_text, image_bytes, media_type, schema):
        b64 = base64.standard_b64encode(image_bytes).decode("ascii")
        resp = self._client.messages.create(
            model=self.model,
            max_tokens=1024,
            system=system,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "image", "source": {"type": "base64", "media_type": media_type, "data": b64}},
                        {"type": "text", "text": user_text},
                    ],
                }
            ],
            output_config={"format": {"type": "json_schema", "schema": schema}},
        )
        text = next((b.text for b in resp.content if b.type == "text"), "")
        return json.loads(text)


class _OpenAICompatProvider:
    """OpenAI / Ollama / Groq / OpenRouter — anything speaking the OpenAI API."""

    def __init__(self, *, base_url, api_key, model, vision_model):
        import openai

        self._client = openai.OpenAI(base_url=base_url or None, api_key=api_key or "not-needed")
        self.model = model
        self.vision_model = vision_model

    def run_agent(self, system, user_text, tools, run_tool, max_iters=6):
        otools = [
            {"type": "function", "function": {"name": t["name"], "description": t["description"], "parameters": t["parameters"]}}
            for t in tools
        ]
        messages: list[Any] = [{"role": "system", "content": system}, {"role": "user", "content": user_text}]
        used: list[str] = []
        for _ in range(max_iters):
            resp = self._client.chat.completions.create(
                model=self.model, messages=messages, tools=otools, max_tokens=1024
            )
            msg = resp.choices[0].message
            calls = msg.tool_calls or []
            if not calls:
                return (msg.content or "").strip(), used
            messages.append(
                {
                    "role": "assistant",
                    "content": msg.content or "",
                    "tool_calls": [
                        {"id": c.id, "type": "function", "function": {"name": c.function.name, "arguments": c.function.arguments}}
                        for c in calls
                    ],
                }
            )
            for c in calls:
                used.append(c.function.name)
                try:
                    args = json.loads(c.function.arguments or "{}")
                except Exception:
                    args = {}
                messages.append({"role": "tool", "tool_call_id": c.id, "content": run_tool(c.function.name, args)})
        return "", used

    def _json(self, model, system, content, schema):
        resp = self._client.chat.completions.create(
            model=model,
            messages=[
                {
                    "role": "system",
                    "content": system + "\nReply with ONLY a JSON object matching this schema: " + json.dumps(schema),
                },
                {"role": "user", "content": content},
            ],
            response_format={"type": "json_object"},
            max_tokens=1500,
        )
        return json.loads(resp.choices[0].message.content or "{}")

    def complete_json(self, system, user_text, schema):
        return self._json(self.model, system, user_text, schema)

    def complete_vision_json(self, system, user_text, image_bytes, media_type, schema):
        # Small local vision models (e.g. moondream) often can't honour
        # response_format / strict JSON, so we ask plainly and parse leniently —
        # a plain description still becomes the report's summary.
        b64 = base64.standard_b64encode(image_bytes).decode("ascii")
        content = [
            {"type": "image_url", "image_url": {"url": f"data:{media_type};base64,{b64}"}},
            {"type": "text", "text": user_text},
        ]
        resp = self._client.chat.completions.create(
            model=self.vision_model,
            messages=[
                {
                    "role": "system",
                    "content": system
                    + "\nReply with ONLY a JSON object matching this schema: "
                    + json.dumps(schema),
                },
                {"role": "user", "content": content},
            ],
            max_tokens=1024,
        )
        return _lenient_json(resp.choices[0].message.content or "")


# Gemini's OpenAI-compatible endpoint (free tier, multimodal).
_GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai/"

_cache: dict[Any, Any] = {}


def _resolve():
    provider = (settings.ai_provider or "").strip().lower()
    if not provider:  # auto-detect from configured keys
        if settings.anthropic_api_key:
            provider = "anthropic"
        elif settings.gemini_api_key:
            provider = "gemini"
        elif settings.openai_api_key:
            provider = "openai"

    if provider == "ollama":
        return _OpenAICompatProvider(
            base_url=settings.ollama_base_url, api_key="ollama",
            model=settings.ollama_model, vision_model=settings.ollama_vision_model,
        )
    if provider == "gemini":
        if not settings.gemini_api_key:
            return None
        return _OpenAICompatProvider(
            base_url=_GEMINI_BASE_URL, api_key=settings.gemini_api_key,
            model=settings.gemini_model, vision_model=settings.gemini_model,
        )
    if provider == "openai":
        return _OpenAICompatProvider(
            base_url=settings.openai_base_url, api_key=settings.openai_api_key,
            model=settings.openai_model, vision_model=settings.openai_vision_model,
        )
    if provider == "anthropic" and settings.anthropic_api_key:
        return _AnthropicProvider()
    return None


def get_provider():
    """The active provider instance, or None (→ rule-based fallback). Cached per config."""
    key = (
        settings.ai_provider,
        settings.anthropic_api_key,
        settings.ai_model,
        settings.openai_api_key,
        settings.openai_base_url,
        settings.openai_model,
        settings.openai_vision_model,
        settings.gemini_api_key,
        settings.gemini_model,
        settings.ollama_base_url,
        settings.ollama_model,
        settings.ollama_vision_model,
    )
    if key not in _cache:
        try:
            _cache[key] = _resolve()
        except Exception:
            _cache[key] = None
    return _cache[key]


def ai_enabled() -> bool:
    return get_provider() is not None
