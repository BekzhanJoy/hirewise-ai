import hashlib
import json
import re
import unicodedata
from typing import Any, Dict, Optional


def stable_hash(text: str, *, algo: str = "sha256", length: int = 32) -> str:
    if text is None:
        text = ""
    data = text.encode("utf-8", errors="ignore")
    algo = (algo or "sha256").lower()
    if algo == "sha1":
        h = hashlib.sha1(data).hexdigest()
    elif algo == "md5":
        h = hashlib.md5(data).hexdigest()
    else:
        h = hashlib.sha256(data).hexdigest()
    return h[: max(8, int(length))]


def normalize_text(text: str) -> str:
    if not text:
        return ""
    text = unicodedata.normalize("NFKC", text)
    text = text.lower()
    # Replace punctuation with spaces so token matching is reliable
    # (e.g. "kubernetes." should match "kubernetes").
    text = re.sub(r"[^a-z0-9\+\#\s]+", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def _strip_code_fences(s: str) -> str:
    s = (s or "").strip()
    if s.startswith("```"):
        s = re.sub(r"^```[a-zA-Z0-9_-]*\s*", "", s)
        s = re.sub(r"\s*```$", "", s)
    return s.strip()


def _drop_think_blocks(s: str) -> str:
    return re.sub(r"<think>[\s\S]*?</think>", "", s or "", flags=re.IGNORECASE).strip()


def extract_first_json_object(raw: str) -> Optional[Dict[str, Any]]:
    if not raw:
        return None
    s = _strip_code_fences(raw)
    s = _drop_think_blocks(s)
    try:
        obj = json.loads(s)
        return obj if isinstance(obj, dict) else None
    except Exception:
        pass
    try:
        start = s.index("{")
        end = s.rindex("}") + 1
        obj = json.loads(s[start:end])
        return obj if isinstance(obj, dict) else None
    except Exception:
        return None


def parse_llm_json(raw: str, *, required_keys: Optional[set] = None) -> Optional[Dict[str, Any]]:
    obj = extract_first_json_object(raw)
    if obj is None:
        return None
    if required_keys and any(k not in obj for k in required_keys):
        return None
    return obj


def coerce_requirements(obj: Dict[str, Any]) -> Dict[str, list]:
    required = obj.get("required", []) if isinstance(obj, dict) else []
    preferred = obj.get("preferred", []) if isinstance(obj, dict) else []

    def _clean_list(x):
        if not isinstance(x, list):
            return []
        out: list = []
        for item in x:
            if not item:
                continue
            s = normalize_text(str(item))
            if s and s not in out:
                out.append(s)
        return out

    return {"required": _clean_list(required), "preferred": _clean_list(preferred)}
