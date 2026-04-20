"""Tests for matcher.embeddings — SentenceTransformer is mocked throughout."""
import numpy as np
import pytest
from unittest.mock import MagicMock, patch
from pathlib import Path


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_fake_encode(dim: int = 384):
    """Return a fake encode() that produces deterministic unit vectors."""
    def _encode(texts, normalize_embeddings=True):
        rng = np.random.default_rng(abs(hash(str(texts))) % (2**31))
        raw = rng.standard_normal((len(texts), dim)).astype(np.float32)
        if normalize_embeddings:
            norms = np.linalg.norm(raw, axis=1, keepdims=True)
            raw = raw / np.where(norms == 0, 1, norms)
        return raw
    return _encode


@pytest.fixture()
def emb_service(tmp_path):
    """EmbeddingsService with a mocked model and a temp cache dir."""
    with patch("matcher.embeddings.SentenceTransformer") as MockST:
        instance = MagicMock()
        instance.encode.side_effect = _make_fake_encode(384)
        MockST.return_value = instance

        from matcher.embeddings import EmbeddingsService
        svc = EmbeddingsService(cache_dir=str(tmp_path))
        yield svc


# ---------------------------------------------------------------------------
# embed_text
# ---------------------------------------------------------------------------

class TestEmbedText:
    def test_returns_1d_float32(self, emb_service):
        v = emb_service.embed_text("some resume text")
        assert v.ndim == 1
        assert v.dtype == np.float32
        assert v.shape == (384,)

    def test_empty_string_returns_zeros(self, emb_service):
        v = emb_service.embed_text("")
        assert v.shape == (384,)
        assert np.all(v == 0.0)

    def test_whitespace_only_returns_zeros(self, emb_service):
        v = emb_service.embed_text("   ")
        assert np.all(v == 0.0)


# ---------------------------------------------------------------------------
# embed_batch
# ---------------------------------------------------------------------------

class TestEmbedBatch:
    def test_shape(self, emb_service):
        texts = ["resume one", "resume two", "resume three"]
        embs = emb_service.embed_batch(texts)
        assert embs.shape == (3, 384)
        assert embs.dtype == np.float32

    def test_empty_list(self, emb_service):
        embs = emb_service.embed_batch([])
        assert embs.shape == (0, 384)


# ---------------------------------------------------------------------------
# get_job_embedding (caching)
# ---------------------------------------------------------------------------

class TestGetJobEmbedding:
    def test_returns_correct_shape(self, emb_service):
        v = emb_service.get_job_embedding("backend engineer with python")
        assert v.shape == (384,)
        assert v.dtype == np.float32

    def test_empty_job_text_returns_zeros(self, emb_service):
        v = emb_service.get_job_embedding("")
        assert np.all(v == 0.0)

    def test_cache_file_created(self, emb_service, tmp_path):
        emb_service.get_job_embedding("python fastapi docker")
        cache_files = list((tmp_path / "embeddings").glob("*_job.npy"))
        assert len(cache_files) == 1

    def test_cache_hit_does_not_call_model_again(self, emb_service):
        text = "some job description"
        emb_service.get_job_embedding(text)
        call_count_after_first = emb_service.model.encode.call_count

        emb_service.get_job_embedding(text)   # should hit cache
        assert emb_service.model.encode.call_count == call_count_after_first

    def test_force_recomputes(self, emb_service):
        text = "some job description"
        emb_service.get_job_embedding(text)
        count_before = emb_service.model.encode.call_count

        emb_service.get_job_embedding(text, force=True)
        assert emb_service.model.encode.call_count > count_before

    def test_different_texts_produce_different_embeddings(self, emb_service):
        v1 = emb_service.get_job_embedding("python backend engineer")
        v2 = emb_service.get_job_embedding("frontend react developer")
        assert not np.allclose(v1, v2)


# ---------------------------------------------------------------------------
# get_resume_embeddings (caching + shape validation)
# ---------------------------------------------------------------------------

class TestGetResumeEmbeddings:
    def test_shape_matches_batch(self, emb_service):
        texts = ["resume a", "resume b", "resume c"]
        embs = emb_service.get_resume_embeddings(texts, cache_key="test_batch_1")
        assert embs.shape == (3, 384)

    def test_cache_file_created(self, emb_service, tmp_path):
        emb_service.get_resume_embeddings(["r1", "r2"], cache_key="ck_abc")
        cache_files = list((tmp_path / "embeddings").glob("*_resumes.npy"))
        assert len(cache_files) == 1

    def test_cache_hit(self, emb_service):
        texts = ["resume one", "resume two"]
        emb_service.get_resume_embeddings(texts, cache_key="ck_hit")
        count = emb_service.model.encode.call_count

        emb_service.get_resume_embeddings(texts, cache_key="ck_hit")
        assert emb_service.model.encode.call_count == count

    def test_stale_cache_recomputed_on_size_change(self, emb_service, tmp_path):
        """If cached array has wrong shape (batch size changed), recompute."""
        texts_2 = ["r1", "r2"]
        emb_service.get_resume_embeddings(texts_2, cache_key="ck_grow")

        # Now request 3 resumes with the same cache key → shape mismatch
        texts_3 = ["r1", "r2", "r3"]
        embs = emb_service.get_resume_embeddings(texts_3, cache_key="ck_grow")
        assert embs.shape == (3, 384)
