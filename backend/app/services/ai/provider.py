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
    # Strip ```json … ``` markdown fences some models wrap around the JSON.
    if text.startswith("```"):
        text = re.sub(r"^```[a-zA-Z0-9]*\s*|\s*```$", "", text).strip()
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
        self.name = "anthropic"

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

    def __init__(self, *, base_url, api_key, model, vision_model, name="openai"):
        import openai

        self._client = openai.OpenAI(base_url=base_url or None, api_key=api_key or "not-needed")
        self.base_url = base_url
        self.model = model
        self.vision_model = vision_model
        self.name = name

    def run_agent(self, system, user_text, tools, run_tool, max_iters=6):
        otools = [
            {"type": "function", "function": {"name": t["name"], "description": t["description"], "parameters": t["parameters"]}}
            for t in tools
        ]
        messages: list[Any] = [{"role": "system", "content": system}, {"role": "user", "content": user_text}]
        used: list[str] = []
        for _ in range(max_iters):
            resp = self._client.chat.completions.create(
                model=self.model, messages=messages, tools=otools, max_tokens=2048
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
            max_tokens=2048,
        )
        return json.loads(resp.choices[0].message.content or "{}")

    def complete_json(self, system, user_text, schema):
        return self._json(self.model, system, user_text, schema)

    def complete_vision_json(self, system, user_text, image_bytes, media_type, schema):
        # Local Ollama vision models (e.g. moondream) are unreliable through the
        # OpenAI-compat image_url path — they often ignore the image and reply
        # like a generic chatbot ("I am an AI assistant..."). Use Ollama's NATIVE
        # API (which attaches the image via the `images` field) with a simple,
        # direct prompt; the description then becomes the report's summary.
        if self.name == "ollama":
            return self._ollama_vision(image_bytes)
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
            max_tokens=4096,  # room for "thinking" models (e.g. gemini-2.5-flash) + the JSON
        )
        return _lenient_json(resp.choices[0].message.content or "")

    def _ollama_native_url(self) -> str:
        base = (self.base_url or "http://localhost:11434/v1").rstrip("/")
        if base.endswith("/v1"):
            base = base[:-3].rstrip("/")
        return base + "/api/chat"

    def _ollama_vision(self, image_bytes: bytes) -> dict:
        """Vision via Ollama's native /api/chat (reliable image attachment)."""
        import urllib.request

        b64 = base64.standard_b64encode(image_bytes).decode("ascii")
        prompt = (
            "You are a construction site supervisor. Look carefully at this site photo and "
            "describe, in 2-4 specific sentences: the overall build progress, the main "
            "structures or materials visible, and any visible safety issues (missing helmets, "
            "no edge protection, unsafe access). Be factual about what you actually see."
        )
        body = json.dumps({
            "model": self.vision_model,
            "messages": [{"role": "user", "content": prompt, "images": [b64]}],
            "stream": False,
            "options": {"num_predict": 512},
        }).encode()
        req = urllib.request.Request(
            self._ollama_native_url(), data=body, headers={"Content-Type": "application/json"}
        )
        with urllib.request.urlopen(req, timeout=180) as resp:
            data = json.loads(resp.read().decode())
        text = ((data.get("message") or {}).get("content") or "").strip()
        return _lenient_json(text)


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
            base_url=settings.ollama_base_url, api_key="ollama", name="ollama",
            model=settings.ollama_model, vision_model=settings.ollama_vision_model,
        )
    if provider == "gemini":
        if not settings.gemini_api_key:
            return None
        return _OpenAICompatProvider(
            base_url=_GEMINI_BASE_URL, api_key=settings.gemini_api_key, name="gemini",
            model=settings.gemini_model, vision_model=settings.gemini_model,
        )
    if provider == "openai":
        return _OpenAICompatProvider(
            base_url=settings.openai_base_url, api_key=settings.openai_api_key, name="openai",
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


def active_info() -> dict:
    """What the status endpoint reports: the REAL active provider + model (or
    the rule-based fallback). Note: 'enabled' means a provider is configured,
    not that its key is valid — a bad key still degrades to the fallback."""
    p = get_provider()
    if p is None:
        return {"enabled": False, "provider": "fallback", "model": None}
    return {"enabled": True, "provider": getattr(p, "name", "?"), "model": getattr(p, "model", None)}
