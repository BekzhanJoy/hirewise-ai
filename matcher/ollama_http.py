import logging
from typing import Any, Dict, Optional

import requests

logger = logging.getLogger(__name__)


DEFAULT_MODEL = "deepseek-r1:1.5b"
OLLAMA_CHAT_URL = "http://localhost:11434/api/chat"


def call_ollama(
    prompt: str,
    *,
    model: str = DEFAULT_MODEL,
    timeout_s: int = 180,
    temperature: float = 0.0,
    system_prompt: Optional[str] = None,
) -> str:
    """
    Call Ollama's /api/chat over HTTP.

    Returns only the assistant "content" string (may include extra text).
    Caller should apply a safe JSON parser when expecting JSON.
    """
    prompt = (prompt or "").strip()
    if not prompt:
        return ""

    messages = []
    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})
    messages.append({"role": "user", "content": prompt})

    payload: Dict[str, Any] = {
        "model": model,
        "messages": messages,
        "stream": False,
        "options": {"temperature": temperature},
    }

    try:
        resp = requests.post(OLLAMA_CHAT_URL, json=payload, timeout=timeout_s)
        resp.raise_for_status()
        data = resp.json()
        return data.get("message", {}).get("content", "") or ""
    except Exception as exc:
        # This matcher pipeline must not crash during ranking.
        logger.warning("call_ollama failed (model=%s): %s", model, exc)
        return ""

