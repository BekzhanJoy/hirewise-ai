import json
import logging
from pathlib import Path
from typing import Optional

from .utils import coerce_requirements, parse_llm_json, stable_hash
from .ollama_http import call_ollama

logger = logging.getLogger(__name__)

_EXTRACTION_PROMPT = """\
Extract job requirements from the job description below.

Return ONLY valid JSON with this exact shape — no explanation, no markdown:
{{
  "required": ["skill or requirement (1-5 words)", "..."],
  "preferred": ["nice-to-have (1-5 words)", "..."]
}}

Rules:
- keep every item short (1-5 words)
- no duplicates
- do not add any text outside the JSON object

Job Description:
{job_text}
"""


_SYSTEM_PROMPT = (
    "You are an expert technical recruiter and information extraction assistant. "
    "Extract job requirements and output ONLY valid JSON exactly matching the requested schema."
)


class RequirementsExtractor:
    def __init__(self, model: str = "deepseek-r1:1.5b", cache_dir: Optional[str] = None):
        base = Path(cache_dir) if cache_dir else (Path(__file__).resolve().parents[1] / "cache")
        self.cache_dir = (base / "jobs").resolve()
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self.model = model

    def _cache_path(self, job_text: str) -> Path:
        return self.cache_dir / f"{stable_hash(job_text, length=32)}_requirements.json"

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def extract_job_requirements(self, job_text: str, *, force: bool = False) -> dict:
        """
        Extract required / preferred skills from *job_text*.

        Returns:
            {"required": [...], "preferred": [...]}

        Results are cached on disk by a hash of the job text so the LLM
        is only called once per unique job description.
        """
        job_text = (job_text or "").strip()
        if not job_text:
            return {"required": [], "preferred": []}

        path = self._cache_path(job_text)

        # --- cache hit ---------------------------------------------------
        if path.exists() and not force:
            try:
                cached = json.loads(path.read_text(encoding="utf-8"))
                result = coerce_requirements(cached)
                # Only trust the cache if it actually has content
                if result["required"] or result["preferred"]:
                    return result
            except Exception as exc:
                logger.warning("Could not read requirements cache (%s), re-extracting.", exc)

        # --- LLM call ----------------------------------------------------
        prompt = _EXTRACTION_PROMPT.format(job_text=job_text[:2000])
        try:
            raw: str = call_ollama(
                prompt,
                model=self.model,
                timeout_s=180,
                temperature=0.0,
                system_prompt=_SYSTEM_PROMPT,
            )
            parsed = parse_llm_json(raw, required_keys={"required", "preferred"})
            if parsed is None:
                logger.error(
                    "LLM returned unparseable content for requirements extraction.\nRaw: %s",
                    raw[:400],
                )
                return {"required": [], "preferred": []}

            out = coerce_requirements(parsed)
            path.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
            return out

        except Exception as exc:
            logger.error("Requirements extraction failed: %s", exc)
            return {"required": [], "preferred": []}


requirements_extractor = RequirementsExtractor()
