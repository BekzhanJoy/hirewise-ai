import numpy as np

import matcher.service as svc


def test_rank_filters_low_scores(monkeypatch):
    # Force fixed requirements so we avoid Ollama.
    monkeypatch.setattr(
        svc.matcher_service.requirements_extractor,
        "extract_job_requirements",
        lambda job_text, force=False: {"required": ["python"], "preferred": []},
        raising=True,
    )

    # Deterministic embeddings: job matches only the first resume.
    monkeypatch.setattr(
        svc.matcher_service.embeddings_service,
        "get_job_embedding",
        lambda job_text, force=False: np.array([1.0, 0.0], dtype=np.float32),
        raising=True,
    )
    monkeypatch.setattr(
        svc.matcher_service.embeddings_service,
        "get_resume_embeddings",
        lambda texts, cache_key, force=False: np.array([[1.0, 0.0], [-1.0, 0.0]], dtype=np.float32),
        raising=True,
    )

    resumes = [
        {"resume_id": "good", "text": "Python developer"},
        {"resume_id": "bad", "text": "Accountant"},
    ]

    out = svc.matcher_service.rank(
        job_text="Need python",
        resume_records=resumes,
        top_k=5,
        explain=False,
        min_score=0.4,
    )

    assert len(out) == 1
    assert out[0]["resume_id"] == "good"


def test_rank_returns_empty_when_all_below_threshold(monkeypatch):
    monkeypatch.setattr(
        svc.matcher_service.requirements_extractor,
        "extract_job_requirements",
        lambda job_text, force=False: {"required": ["python"], "preferred": []},
        raising=True,
    )

    monkeypatch.setattr(
        svc.matcher_service.embeddings_service,
        "get_job_embedding",
        lambda job_text, force=False: np.array([-1.0, 0.0], dtype=np.float32),
        raising=True,
    )
    monkeypatch.setattr(
        svc.matcher_service.embeddings_service,
        "get_resume_embeddings",
        lambda texts, cache_key, force=False: np.array([[-1.0, 0.0], [-1.0, 0.0]], dtype=np.float32),
        raising=True,
    )

    resumes = [{"resume_id": "a", "text": "Nothing"}, {"resume_id": "b", "text": "Nothing"}]

    out = svc.matcher_service.rank(job_text="Need python", resume_records=resumes, top_k=5, explain=False, min_score=0.9)
    assert out == []

"""
Integration tests for matcher.service.MatcherService.

All external dependencies (SentenceTransformer, Ollama) are mocked so
tests run offline, fast, and deterministically.
"""
import numpy as np
import pytest
from unittest.mock import MagicMock, patch


# ---------------------------------------------------------------------------
# Shared fixtures
# ---------------------------------------------------------------------------

RESUME_BACKEND = (
    "Senior Python developer. Built REST APIs with FastAPI and Docker. "
    "Deployed to Kubernetes. PostgreSQL and Redis experience. CI/CD with Git."
)
RESUME_FRONTEND = (
    "Frontend engineer. React, TypeScript, JavaScript, Node.js. "
    "Responsive CSS and HTML. Git version control."
)
RESUME_JUNIOR = (
    "Junior developer. Basic Python knowledge. Some Git usage."
)

JOB_TEXT = (
    "We are looking for a backend engineer with Python, FastAPI, Docker, "
    "and Kubernetes experience. PostgreSQL is required. AWS is preferred."
)

REQUIREMENTS = {
    "required": ["python", "fastapi", "docker", "kubernetes", "postgresql"],
    "preferred": ["aws"],
}


def _fake_encode(dim: int = 384):
    """Returns a fake encode() that is deterministic per input."""
    def _encode(texts, normalize_embeddings=True):
        out = []
        for t in texts:
            rng = np.random.default_rng(abs(hash(t[:80])) % (2**31))
            v = rng.standard_normal(dim).astype(np.float32)
            if normalize_embeddings:
                n = np.linalg.norm(v)
                v = v / (n if n > 0 else 1)
            out.append(v)
        return np.array(out, dtype=np.float32)
    return _encode


@pytest.fixture()
def service(tmp_path):
    """MatcherService with all external I/O mocked."""
    with (
        patch("matcher.embeddings.SentenceTransformer") as MockST,
        patch("matcher.requirements.call_ollama") as mock_req_call_ollama,
        patch("matcher.service.call_ollama") as mock_svc_call_ollama,
    ):
        # Mock sentence transformer
        st_instance = MagicMock()
        st_instance.encode.side_effect = _fake_encode(384)
        MockST.return_value = st_instance

        # Mock requirement extraction
        mock_req_call_ollama.return_value = (
            '{"required": ["python","fastapi","docker","kubernetes","postgresql"],'
            '"preferred": ["aws"]}'
        )

        # Mock explanation generation
        mock_svc_call_ollama.return_value = "Strong backend candidate with relevant experience."

        from matcher.service import MatcherService
        svc = MatcherService(cache_dir=str(tmp_path))
        svc._mocks = {
            "st": st_instance,
            "req_ollama": mock_req_call_ollama,
            "svc_ollama": mock_svc_call_ollama,
        }
        yield svc


# ---------------------------------------------------------------------------
# Return structure
# ---------------------------------------------------------------------------

class TestRankReturnStructure:
    def test_returns_list(self, service):
        records = [{"resume_id": "r1", "text": RESUME_BACKEND}]
        result = service.rank(job_text=JOB_TEXT, resume_records=records, explain=False)
        assert isinstance(result, list)

    def test_each_item_has_required_keys(self, service):
        records = [{"resume_id": "r1", "text": RESUME_BACKEND}]
        result = service.rank(job_text=JOB_TEXT, resume_records=records, explain=False)
        assert len(result) == 1
        item = result[0]
        for key in ("resume_id", "score", "semantic", "coverage", "matched", "missing"):
            assert key in item, f"Missing key: {key}"

    def test_explanation_key_present_when_explain_true(self, service):
        records = [{"resume_id": "r1", "text": RESUME_BACKEND}]
        result = service.rank(job_text=JOB_TEXT, resume_records=records, explain=True)
        assert "explanation" in result[0]
        assert isinstance(result[0]["explanation"], str)

    def test_explanation_empty_when_explain_false(self, service):
        records = [{"resume_id": "r1", "text": RESUME_BACKEND}]
        result = service.rank(job_text=JOB_TEXT, resume_records=records, explain=False)
        assert result[0]["explanation"] == ""

    def test_original_fields_preserved(self, service):
        records = [{"resume_id": "r1", "text": RESUME_BACKEND, "candidate_name": "Alice"}]
        result = service.rank(job_text=JOB_TEXT, resume_records=records, explain=False)
        assert result[0]["candidate_name"] == "Alice"

    def test_scores_in_01_range(self, service):
        records = [
            {"resume_id": "r1", "text": RESUME_BACKEND},
            {"resume_id": "r2", "text": RESUME_FRONTEND},
        ]
        result = service.rank(job_text=JOB_TEXT, resume_records=records, explain=False)
        for item in result:
            assert 0.0 <= item["score"] <= 1.0
            assert 0.0 <= item["semantic"] <= 1.0
            assert 0.0 <= item["coverage"] <= 1.0


# ---------------------------------------------------------------------------
# Ranking order
# ---------------------------------------------------------------------------

class TestRankOrder:
    def test_sorted_descending_by_score(self, service):
        records = [
            {"resume_id": "backend", "text": RESUME_BACKEND},
            {"resume_id": "frontend", "text": RESUME_FRONTEND},
            {"resume_id": "junior", "text": RESUME_JUNIOR},
        ]
        result = service.rank(job_text=JOB_TEXT, resume_records=records, explain=False)
        scores = [r["score"] for r in result]
        assert scores == sorted(scores, reverse=True)

    def test_backend_resume_outscores_frontend(self, service):
        records = [
            {"resume_id": "backend", "text": RESUME_BACKEND},
            {"resume_id": "frontend", "text": RESUME_FRONTEND},
        ]
        result = service.rank(job_text=JOB_TEXT, resume_records=records, explain=False)
        ids = [r["resume_id"] for r in result]
        assert ids[0] == "backend"

    def test_resume_id_assigned_when_missing(self, service):
        records = [{"text": RESUME_BACKEND}]   # no resume_id
        result = service.rank(job_text=JOB_TEXT, resume_records=records, explain=False)
        assert result[0]["resume_id"] == "row_0"


# ---------------------------------------------------------------------------
# top_k behaviour
# ---------------------------------------------------------------------------

class TestTopK:
    def test_top_k_limits_results(self, service):
        records = [{"resume_id": f"r{i}", "text": RESUME_BACKEND} for i in range(10)]
        result = service.rank(job_text=JOB_TEXT, resume_records=records, top_k=3, explain=False)
        assert len(result) == 3

    def test_top_k_larger_than_input_returns_all(self, service):
        records = [{"resume_id": "r1", "text": RESUME_BACKEND}]
        result = service.rank(job_text=JOB_TEXT, resume_records=records, top_k=10, explain=False)
        assert len(result) == 1

    def test_top_k_zero_returns_one(self, service):
        records = [{"resume_id": "r1", "text": RESUME_BACKEND}]
        result = service.rank(job_text=JOB_TEXT, resume_records=records, top_k=0, explain=False)
        assert len(result) >= 1


# ---------------------------------------------------------------------------
# Edge / guard cases
# ---------------------------------------------------------------------------

class TestEdgeCases:
    def test_empty_job_text_returns_empty(self, service):
        records = [{"resume_id": "r1", "text": RESUME_BACKEND}]
        result = service.rank(job_text="", resume_records=records)
        assert result == []

    def test_whitespace_job_text_returns_empty(self, service):
        records = [{"resume_id": "r1", "text": RESUME_BACKEND}]
        result = service.rank(job_text="   ", resume_records=records)
        assert result == []

    def test_empty_resume_list_returns_empty(self, service):
        result = service.rank(job_text=JOB_TEXT, resume_records=[])
        assert result == []

    def test_resume_with_no_text_field(self, service):
        records = [{"resume_id": "r1"}]   # no "text" key
        result = service.rank(job_text=JOB_TEXT, resume_records=records, explain=False)
        assert len(result) == 1
        assert result[0]["resume_id"] == "r1"

    def test_explanation_failure_does_not_crash(self, service):
        service._mocks["svc_ollama"].side_effect = RuntimeError("Ollama down")
        records = [{"resume_id": "r1", "text": RESUME_BACKEND}]
        result = service.rank(job_text=JOB_TEXT, resume_records=records, explain=True)
        # Should still return results with empty explanation
        assert len(result) == 1
        assert result[0]["explanation"] == ""


# ---------------------------------------------------------------------------
# Caching integration
# ---------------------------------------------------------------------------

class TestCachingIntegration:
    def test_llm_called_once_for_repeated_job(self, service):
        records = [{"resume_id": "r1", "text": RESUME_BACKEND}]
        service.rank(job_text=JOB_TEXT, resume_records=records, explain=False)
        service.rank(job_text=JOB_TEXT, resume_records=records, explain=False)
        # Requirements LLM should only have been called once
        assert service._mocks["req_ollama"].call_count == 1

    def test_force_cache_re_extracts_requirements(self, service):
        records = [{"resume_id": "r1", "text": RESUME_BACKEND}]
        service.rank(job_text=JOB_TEXT, resume_records=records, explain=False)
        service.rank(job_text=JOB_TEXT, resume_records=records, explain=False, force_cache=True)
        assert service._mocks["req_ollama"].call_count == 2

    def test_explanation_llm_only_called_for_top_k(self, service):
        records = [{"resume_id": f"r{i}", "text": RESUME_BACKEND} for i in range(10)]
        service.rank(job_text=JOB_TEXT, resume_records=records, top_k=3, explain=True)
        # Explanation model should only be called 3 times (for top_k candidates)
        assert service._mocks["svc_ollama"].call_count == 3
