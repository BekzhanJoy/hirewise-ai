"""Tests for matcher.scoring"""
import numpy as np
import pytest
from matcher.scoring import (
    cosine_similarity,
    semantic_similarity_01,
    fuzzy_match_skill,
    compute_coverage,
    final_score,
)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

RESUME_BACKEND = """
Software Engineer with 5 years of experience.
Built scalable REST APIs using Python and FastAPI.
Deployed containerized applications using Docker and Kubernetes.
Worked with PostgreSQL and Redis for data storage.
Experience with CI/CD pipelines and Git workflows.
"""

RESUME_FRONTEND = """
Frontend Developer specializing in React and TypeScript.
Built interactive dashboards with JavaScript and Node.js.
Experience with CSS, HTML, and responsive design.
Used Git for version control.
"""

RESUME_EMPTY = ""


# ---------------------------------------------------------------------------
# cosine_similarity
# ---------------------------------------------------------------------------

class TestCosineSimilarity:
    def test_identical_vectors(self):
        v = np.array([1.0, 0.0, 0.0])
        assert cosine_similarity(v, v) == pytest.approx(1.0)

    def test_orthogonal_vectors(self):
        a = np.array([1.0, 0.0])
        b = np.array([0.0, 1.0])
        assert cosine_similarity(a, b) == pytest.approx(0.0)

    def test_opposite_vectors(self):
        v = np.array([1.0, 0.0])
        assert cosine_similarity(v, -v) == pytest.approx(-1.0)

    def test_zero_vector_returns_zero(self):
        a = np.zeros(4)
        b = np.array([1.0, 0.0, 0.0, 0.0])
        assert cosine_similarity(a, b) == 0.0

    def test_both_zero_returns_zero(self):
        a = np.zeros(4)
        assert cosine_similarity(a, a) == 0.0


# ---------------------------------------------------------------------------
# semantic_similarity_01
# ---------------------------------------------------------------------------

class TestSemanticSimilarity01:
    def test_output_range(self):
        rng = np.random.default_rng(42)
        for _ in range(20):
            a = rng.standard_normal(384).astype(np.float32)
            b = rng.standard_normal(384).astype(np.float32)
            val = semantic_similarity_01(a, b)
            assert 0.0 <= val <= 1.0

    def test_identical_normalized_vectors_return_one(self):
        v = np.ones(4, dtype=np.float32)
        v /= np.linalg.norm(v)
        assert semantic_similarity_01(v, v) == pytest.approx(1.0)

    def test_opposite_vectors_return_zero(self):
        v = np.array([1.0, 0.0, 0.0, 0.0], dtype=np.float32)
        assert semantic_similarity_01(v, -v) == pytest.approx(0.0)


# ---------------------------------------------------------------------------
# fuzzy_match_skill
# ---------------------------------------------------------------------------

class TestFuzzyMatchSkill:
    # --- exact matches ---
    def test_exact_single_word(self):
        assert fuzzy_match_skill("python", "experienced python developer") == pytest.approx(1.0)

    def test_exact_multiword(self):
        assert fuzzy_match_skill("machine learning", "worked on machine learning projects") == pytest.approx(1.0)

    def test_case_insensitive(self):
        assert fuzzy_match_skill("Python", "experienced PYTHON developer") == pytest.approx(1.0)

    # --- substring safety ---
    def test_no_partial_word_match(self):
        # "java" must NOT match "javascript"
        score = fuzzy_match_skill("java", "built apps with javascript only")
        assert score < 0.85

    def test_java_matches_when_standalone(self):
        assert fuzzy_match_skill("java", "5 years of java development") == pytest.approx(1.0)

    # --- abbreviations / synonyms (partial overlap) ---
    def test_kubernetes_abbreviation(self):
        # "k8s" won't reach threshold but "kubernetes" will
        assert fuzzy_match_skill("kubernetes", RESUME_BACKEND) >= 0.85

    def test_postgresql_in_text(self):
        assert fuzzy_match_skill("postgresql", RESUME_BACKEND) >= 0.85

    # --- not present ---
    def test_skill_not_present(self):
        score = fuzzy_match_skill("aws", RESUME_BACKEND)
        assert score < 0.85

    # --- edge cases ---
    def test_empty_skill(self):
        assert fuzzy_match_skill("", RESUME_BACKEND) == 0.0

    def test_empty_resume(self):
        assert fuzzy_match_skill("python", "") == 0.0

    def test_both_empty(self):
        assert fuzzy_match_skill("", "") == 0.0


# ---------------------------------------------------------------------------
# compute_coverage
# ---------------------------------------------------------------------------

class TestComputeCoverage:
    def test_full_coverage(self):
        required = ["python", "fastapi", "docker"]
        preferred = []
        cov, matched, missing = compute_coverage(RESUME_BACKEND, required, preferred)
        assert cov == pytest.approx(1.0)
        assert set(matched) == {"python", "fastapi", "docker"}
        assert missing == []

    def test_partial_coverage(self):
        required = ["python", "fastapi", "aws"]   # aws not in resume
        preferred = []
        cov, matched, missing = compute_coverage(RESUME_BACKEND, required, preferred)
        assert 0.0 < cov < 1.0
        assert "aws" in missing
        assert "python" in matched

    def test_zero_coverage(self):
        required = ["aws", "terraform", "go"]
        preferred = []
        cov, matched, missing = compute_coverage(RESUME_BACKEND, required, preferred)
        assert cov == pytest.approx(0.0)
        assert matched == []
        assert set(missing) == {"aws", "terraform", "go"}

    def test_preferred_contribute_at_half_weight(self):
        # 0 required, 2 preferred both matched → coverage should be 1.0
        required = []
        preferred = ["python", "docker"]
        cov, matched, _ = compute_coverage(RESUME_BACKEND, required, preferred)
        assert cov == pytest.approx(1.0)
        assert "python" in matched
        assert "docker" in matched

    def test_preferred_miss_not_in_missing(self):
        # Missed preferred skills should NOT appear in `missing`
        required = ["python"]
        preferred = ["aws"]   # not in resume
        _, _, missing = compute_coverage(RESUME_BACKEND, required, preferred)
        assert "aws" not in missing

    def test_empty_requirements_returns_zero(self):
        cov, matched, missing = compute_coverage(RESUME_BACKEND, [], [])
        assert cov == 0.0
        assert matched == []
        assert missing == []

    def test_empty_resume(self):
        cov, matched, missing = compute_coverage("", ["python", "docker"], [])
        assert cov == pytest.approx(0.0)
        assert matched == []

    def test_score_clamped_to_01(self):
        # Provide many skills that all match — score must never exceed 1
        required = ["python", "fastapi", "docker", "kubernetes", "postgresql", "redis", "git"]
        cov, _, _ = compute_coverage(RESUME_BACKEND, required, [])
        assert 0.0 <= cov <= 1.0

    def test_frontend_resume_against_backend_job(self):
        required = ["python", "fastapi", "docker", "postgresql"]
        cov, matched, missing = compute_coverage(RESUME_FRONTEND, required, [])
        # Frontend resume should score low on backend requirements
        assert cov < 0.5
        assert len(missing) > len(matched)


# ---------------------------------------------------------------------------
# final_score
# ---------------------------------------------------------------------------

class TestFinalScore:
    def test_perfect_scores(self):
        assert final_score(1.0, 1.0) == pytest.approx(1.0)

    def test_zero_scores(self):
        assert final_score(0.0, 0.0) == pytest.approx(0.0)

    def test_weighted_combination(self):
        # 0.7 * 0.8 + 0.3 * 0.6 = 0.56 + 0.18 = 0.74
        result = final_score(0.8, 0.6)
        assert result == pytest.approx(0.74, abs=1e-4)

    def test_custom_weights(self):
        result = final_score(1.0, 0.0, w_sem=0.5, w_cov=0.5)
        assert result == pytest.approx(0.5)

    def test_output_clamped_to_01(self):
        # Should never exceed 1.0 even with odd weight combos
        assert final_score(1.0, 1.0, w_sem=0.9, w_cov=0.9) <= 1.0

    @pytest.mark.parametrize("sem,cov", [
        (0.0, 0.0),
        (0.5, 0.5),
        (1.0, 0.0),
        (0.0, 1.0),
        (0.3, 0.9),
    ])
    def test_output_always_in_range(self, sem, cov):
        score = final_score(sem, cov)
        assert 0.0 <= score <= 1.0
