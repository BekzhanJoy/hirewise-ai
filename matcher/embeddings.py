import logging
from pathlib import Path
from typing import List, Optional

import numpy as np
from sentence_transformers import SentenceTransformer

from .utils import stable_hash

logger = logging.getLogger(__name__)


class EmbeddingsService:
    def __init__(self, model_name: str = "all-MiniLM-L6-v2", cache_dir: Optional[str] = None):
        base = Path(cache_dir) if cache_dir else (Path(__file__).resolve().parents[1] / "cache")
        self.cache_dir = (base / "embeddings").resolve()
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self._model_name = model_name
        self._model: Optional[SentenceTransformer] = None

    @property
    def model(self) -> SentenceTransformer:
        if self._model is None:
            logger.info("Loading embedding model: %s", self._model_name)
            self._model = SentenceTransformer(self._model_name)
        return self._model

    @property
    def embedding_dim(self) -> int:
        # Tests mock SentenceTransformer without this method; default MiniLM dim.
        try:
            dim = int(self.model.get_sentence_embedding_dimension())
            return dim if dim > 1 else 384
        except Exception:
            return 384

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _job_path(self, job_text: str) -> Path:
        return self.cache_dir / f"{stable_hash(job_text, length=32)}_job.npy"

    def _resume_path(self, cache_key: str) -> Path:
        return self.cache_dir / f"{cache_key}_resumes.npy"

    # ------------------------------------------------------------------
    # Low-level encode (always returns normalized float32 arrays)
    # ------------------------------------------------------------------

    def embed_text(self, text: str) -> np.ndarray:
        """Encode a single string → 1-D float32 vector."""
        if not text or not text.strip():
            return np.zeros(self.embedding_dim, dtype=np.float32)
        return np.asarray(
            self.model.encode([text], normalize_embeddings=True)[0],
            dtype=np.float32,
        )

    def embed_batch(self, texts: List[str]) -> np.ndarray:
        """Encode a list of strings → 2-D float32 array (N, dim)."""
        if not texts:
            return np.zeros((0, self.embedding_dim), dtype=np.float32)
        # Replace empty strings so the model never sees blank input
        clean = [t if (t and t.strip()) else " " for t in texts]
        return np.asarray(
            self.model.encode(clean, normalize_embeddings=True),
            dtype=np.float32,
        )

    # ------------------------------------------------------------------
    # Cached public API
    # ------------------------------------------------------------------

    def get_job_embedding(self, job_text: str, *, force: bool = False) -> np.ndarray:
        """Return cached job embedding, computing and saving if needed."""
        job_text = (job_text or "").strip()
        if not job_text:
            return np.zeros(self.embedding_dim, dtype=np.float32)

        p = self._job_path(job_text)
        if p.exists() and not force:
            try:
                emb = np.load(p)
                if emb.shape == (self.embedding_dim,):
                    return emb
            except Exception as exc:
                logger.warning("Could not load cached job embedding (%s), recomputing.", exc)

        emb = self.embed_text(job_text)
        np.save(p, emb)
        return emb

    def get_resume_embeddings(
        self,
        resume_texts: List[str],
        *,
        cache_key: str,
        force: bool = False,
    ) -> np.ndarray:
        """
        Return cached resume embeddings, computing and saving if needed.

        `cache_key` should change whenever the resume set changes
        (see MatcherService._resume_batch_cache_key).
        """
        p = self._resume_path(cache_key)
        n = len(resume_texts)

        if p.exists() and not force:
            try:
                emb = np.load(p)
                # Validate shape: must match current batch size
                if emb.shape == (n, self.embedding_dim):
                    return emb
                logger.warning(
                    "Cached resume embeddings shape %s does not match batch size %d — recomputing.",
                    emb.shape,
                    n,
                )
            except Exception as exc:
                logger.warning("Could not load cached resume embeddings (%s), recomputing.", exc)

        emb = self.embed_batch(resume_texts)
        np.save(p, emb)
        return emb


embeddings_service = EmbeddingsService()
