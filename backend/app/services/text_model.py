"""Minimal client for the local OpenAI-compatible text model (Qwen on port 9001)."""

from __future__ import annotations

import json
import re

import httpx

from app.core.config import Settings


class TextModelUnavailable(RuntimeError):
    """The text model is not configured, not reachable, or returned something unusable."""


def _strip_thinking(text: str) -> str:
    return re.sub(r"<think>.*?</think>", "", text, flags=re.DOTALL).strip()


def chat_json(settings: Settings, system: str, user: str, max_tokens: int = 700) -> dict:
    """Ask the model for one JSON object. Raises TextModelUnavailable on any failure."""
    if not settings.text_model_url:
        raise TextModelUnavailable("No text model is configured.")
    payload = {
        "model": settings.text_model_name,
        "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}],
        "temperature": 0.2,
        "max_tokens": max_tokens,
        # Qwen3 templates honour this; other servers ignore unknown fields.
        "chat_template_kwargs": {"enable_thinking": False},
    }
    url = settings.text_model_url.rstrip("/") + "/v1/chat/completions"
    try:
        response = httpx.post(url, json=payload, timeout=settings.text_model_timeout_seconds)
        response.raise_for_status()
        content = response.json()["choices"][0]["message"]["content"] or ""
    except (httpx.HTTPError, KeyError, IndexError, TypeError, ValueError) as exc:
        raise TextModelUnavailable(str(exc)) from exc
    text = _strip_thinking(content)
    start, end = text.find("{"), text.rfind("}")
    if start < 0 or end <= start:
        raise TextModelUnavailable("The model did not return JSON.")
    try:
        data = json.loads(text[start:end + 1])
    except json.JSONDecodeError as exc:
        raise TextModelUnavailable("The model returned invalid JSON.") from exc
    if not isinstance(data, dict):
        raise TextModelUnavailable("The model returned JSON that is not an object.")
    return data
