"""
service.py
----------
Main orchestration layer.

Pipeline
--------
1.  Extract job requirements via LLM (cached per job hash).
2.  Compute job embedding (cached per job hash).
3.  Compute resume embeddings (cached per resume-batch hash).
4.  Score every resume:
        semantic_similarity  (0.7 weight)
        requirement_coverage (0.3 weight)
5.  Rank and return top-k.
6.  Optionally generate a human-readable LLM explanation per candidate.
"""

import logging
from pathlib import Path
from typing import Any, Dict, List, Optional

from .embeddings import EmbeddingsService
from .requirements import RequirementsExtractor
from .scoring import compute_coverage, final_score, semantic_similarity_01
from .ollama_http import call_ollama
from .utils import stable_hash

logger = logging.getLogger(__name__)

_EXPLANATION_PROMPT = """\
You are a technical recruiter. Evaluate how well the candidate matches the job.

Job Requirements:
{job_requirements}

Candidate Resume:
{resume_text}

Matched requirements: {matched}
Missing requirements: {missing}
Semantic similarity score: {semantic:.2f}
Requirement coverage score: {coverage:.2f}
Overall suitability score: {score:.2f}

Write 2-3 sentences explaining the candidate's fit. Be specific and concise.
Do not repeat the scores — explain the *reasoning* behind them.
"""


class MatcherService:
    def __init__(
        self,
        cache_dir: Optional[str] = None,
        explanation_model: str = "deepseek-r1:1.5b",
    ):
        base = Path(cache_dir) if cache_dir else (Path(__file__).resolve().parents[1] / "cache")
        self.cache_dir = base.resolve()
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self.explanation_model = explanation_model
        self.requirements_extractor = RequirementsExtractor(cache_dir=str(self.cache_dir))
        self.embeddings_service = EmbeddingsService(cache_dir=str(self.cache_dir))

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def _resume_batch_cache_key(self, resume_records: List[Dict[str, Any]]) -> str:
        """
        Produce a stable hash key for a batch of resumes.
        Changes whenever resume ids or their text content change.
        """
        parts: list = []
        for r in resume_records:
            rid = str(r.get("resume_id") or r.get("id") or "")
            txt = str(r.get("text") or "")
            parts.append(f"{rid}:{stable_hash(txt, length=16)}")
        return stable_hash("|".join(parts), length=32)

    def _generate_explanation(
        self,
        *,
        job_requirements: dict,
        resume_text: str,
        matched: List[str],
        missing: List[str],
        semantic: float,
        coverage: float,
        score: float,
    ) -> str:
        """
        Call the LLM to produce a recruiter-style explanation for one candidate.
        Returns an empty string on failure so it never blocks the ranking result.
        """
        req_summary = (
            "Required: " + ", ".join(job_requirements.get("required", [])) +
            " | Preferred: " + ", ".join(job_requirements.get("preferred", []))
        )
        prompt = _EXPLANATION_PROMPT.format(
            job_requirements=req_summary,
            resume_text=resume_text[:1500],   # keep prompt within context window
            matched=", ".join(matched) or "none",
            missing=", ".join(missing) or "none",
            semantic=semantic,
            coverage=coverage,
            score=score,
        )
        try:
            raw = call_ollama(
                prompt,
                model=self.explanation_model,
                timeout_s=180,
                temperature=0.3,
                system_prompt="You are a technical recruiter. Reply with 2-3 short sentences.",
            ).strip()
            # Strip any residual <think> blocks (deepseek-r1 style)
            import re
            raw = re.sub(r"<think>[\s\S]*?</think>", "", raw, flags=re.IGNORECASE).strip()
            return raw
        except Exception as exc:
            logger.warning("Explanation generation failed for a candidate: %s", exc)
            return ""

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def rank(
        self,
        *,
        job_text: str,
        resume_records: List[Dict[str, Any]],
        top_k: int = 5,
        explain: bool = True,
        force_cache: bool = False,
        min_score: float = 0.0,
    ) -> List[Dict[str, Any]]:
        """
        Rank *resume_records* against *job_text*.

        Parameters
        ----------
        job_text : str
            Full text of the job description.
        resume_records : list of dict
            Each dict must have at least ``"text"`` (resume body) and
            optionally ``"resume_id"`` / ``"id"``.
        top_k : int
            Number of top candidates to return.
        explain : bool
            If True, call the LLM to generate a natural-language explanation
            for each returned candidate.  Set False to skip LLM calls
            (faster, useful for bulk pre-screening).
        force_cache : bool
            If True, recompute and overwrite all cached artefacts.

        Returns
        -------
        list of dict, sorted by ``score`` descending, length ≤ top_k.

        Each result dict contains:
            resume_id   : str
            score       : float  overall suitability [0, 1]
            semantic    : float  semantic similarity [0, 1]
            coverage    : float  requirement coverage [0, 1]
            matched     : list[str]  requirements found in resume
            missing     : list[str]  required skills not found
            explanation : str   LLM-generated recruiter note (if explain=True)
            + all original keys from the input record
        """
        job_text = (job_text or "").strip()
        if not job_text or not resume_records:
            return []

        logger.info("Processing %d resumes", len(resume_records))

        # ── Step 1: extract job requirements (LLM, cached) ──────────────
        reqs = self.requirements_extractor.extract_job_requirements(job_text, force=force_cache)
        required = reqs.get("required", [])
        preferred = reqs.get("preferred", [])
        logger.info(
            "Job requirements — required: %d, preferred: %d",
            len(required), len(preferred),
        )

        # ── Step 2: compute embeddings (model, cached) ───────────────────
        job_emb = self.embeddings_service.get_job_embedding(job_text, force=force_cache)
        resume_texts = [str(r.get("text") or "") for r in resume_records]
        cache_key = self._resume_batch_cache_key(resume_records)
        resume_embs = self.embeddings_service.get_resume_embeddings(
            resume_texts, cache_key=cache_key, force=force_cache
        )

        # ── Step 3: score every resume ───────────────────────────────────
        scored: List[Dict[str, Any]] = []
        for i, r in enumerate(resume_records):
            rid = str(r.get("resume_id") or r.get("id") or f"row_{i}")
            text = str(r.get("text") or "")

            semantic = semantic_similarity_01(job_emb, resume_embs[i])
            coverage, matched, missing = compute_coverage(text, required, preferred)
            score = final_score(semantic, coverage)

            if min_score and score < min_score:
                continue

            entry: Dict[str, Any] = {
                "resume_id": rid,
                "score": round(score, 4),
                "semantic": round(semantic, 4),
                "coverage": round(coverage, 4),
                "matched": matched,
                "missing": missing,
                "explanation": "",
                # Preserve all original fields (without overwriting our keys)
                **{k: v for k, v in r.items() if k not in {
                    "score", "semantic", "coverage", "matched", "missing", "explanation"
                }},
            }
            scored.append(entry)

        # ── Step 4: sort and truncate ────────────────────────────────────
        scored.sort(key=lambda x: x["score"], reverse=True)
        if not scored:
            return []
        top = scored[: max(1, int(top_k))]

        # ── Step 5: LLM explanations for top-k only ──────────────────────
        if explain:
            for entry in top:
                entry["explanation"] = self._generate_explanation(
                    job_requirements=reqs,
                    resume_text=str(entry.get("text") or ""),
                    matched=entry["matched"],
                    missing=entry["missing"],
                    semantic=entry["semantic"],
                    coverage=entry["coverage"],
                    score=entry["score"],
                )

        return top


matcher_service = MatcherService()
