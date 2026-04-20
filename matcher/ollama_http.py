import logging
import os
from typing import Any, Dict, Optional

import requests

logger = logging.getLogger(__name__)

DEFAULT_MODEL = os.getenv("OLLAMA_MODEL", "deepseek-r1:1.5b")
OLLAMA_BASE_URL = (os.getenv("OLLAMA_BASE_URL") or "http://127.0.0.1:11434").rstrip("/")
OLLAMA_CHAT_URL = f"{OLLAMA_BASE_URL}/api/chat"

def call_ollama(
    prompt: str,
    *,
    model: str = DEFAULT_MODEL,
    timeout_s: int = 180,
    temperature: float = 0.0,
    system_prompt: Optional[str] = None,
) -> str:
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
        "keep_alive": "10m",
        "options": {"temperature": temperature},
    }

    try:
        resp = requests.post(
            OLLAMA_CHAT_URL,
            json=payload,
            timeout=timeout_s,
            headers={"Content-Type": "application/json"},
        )
        resp.raise_for_status()
        data = resp.json()
        return data.get("message", {}).get("content", "") or ""
    except Exception as exc:
        logger.warning("call_ollama failed (model=%s): %s", model, exc)
        return ""
