"""Tests for matcher.requirements — Ollama HTTP is mocked throughout."""
import json
import pytest
from unittest.mock import patch


@pytest.fixture()
def extractor(tmp_path):
    with patch("matcher.requirements.call_ollama") as mock_call_ollama:
        from matcher.requirements import RequirementsExtractor
        svc = RequirementsExtractor(cache_dir=str(tmp_path))
        svc._mock_call_ollama = mock_call_ollama
        yield svc


# ---------------------------------------------------------------------------
# Basic extraction
# ---------------------------------------------------------------------------

class TestExtractJobRequirements:
    def test_valid_response(self, extractor):
        extractor._mock_call_ollama.return_value = '{"required": ["Python", "FastAPI"], "preferred": ["Docker"]}'
        result = extractor.extract_job_requirements("some job text")
        assert result["required"] == ["python", "fastapi"]
        assert result["preferred"] == ["docker"]

    def test_response_in_code_fence(self, extractor):
        extractor._mock_call_ollama.return_value = '```json\n{"required": ["Go"], "preferred": ["Kubernetes"]}\n```'
        result = extractor.extract_job_requirements("another job")
        assert "go" in result["required"]
        assert "kubernetes" in result["preferred"]

    def test_think_blocks_stripped(self, extractor):
        extractor._mock_call_ollama.return_value = '<think>let me think</think>\n{"required": ["Rust"], "preferred": []}'
        result = extractor.extract_job_requirements("rust job")
        assert "rust" in result["required"]

    def test_empty_job_text_returns_empty(self, extractor):
        result = extractor.extract_job_requirements("")
        assert result == {"required": [], "preferred": []}
        extractor._mock_call_ollama.assert_not_called()

    def test_whitespace_only_returns_empty(self, extractor):
        result = extractor.extract_job_requirements("   ")
        assert result == {"required": [], "preferred": []}

    def test_llm_failure_returns_empty(self, extractor):
        extractor._mock_call_ollama.side_effect = ConnectionError("Ollama not running")
        result = extractor.extract_job_requirements("some job")
        assert result == {"required": [], "preferred": []}

    def test_malformed_json_returns_empty(self, extractor):
        extractor._mock_call_ollama.return_value = "Sorry, I cannot extract that."
        result = extractor.extract_job_requirements("some job")
        assert result == {"required": [], "preferred": []}

    def test_missing_preferred_key_returns_empty(self, extractor):
        # JSON is valid but missing 'preferred' key → parse_llm_json returns None
        extractor._mock_call_ollama.return_value = '{"required": ["python"]}'
        result = extractor.extract_job_requirements("some job")
        assert result == {"required": [], "preferred": []}


# ---------------------------------------------------------------------------
# Caching behaviour
# ---------------------------------------------------------------------------

class TestRequirementsCache:
    def test_llm_called_once_for_same_job(self, extractor):
        extractor._mock_call_ollama.return_value = '{"required": ["python"], "preferred": []}'
        extractor.extract_job_requirements("identical job text")
        extractor.extract_job_requirements("identical job text")
        assert extractor._mock_call_ollama.call_count == 1

    def test_llm_called_again_for_different_job(self, extractor):
        extractor._mock_call_ollama.return_value = '{"required": ["python"], "preferred": []}'
        extractor.extract_job_requirements("job A")
        extractor.extract_job_requirements("job B")
        assert extractor._mock_call_ollama.call_count == 2

    def test_force_bypasses_cache(self, extractor):
        extractor._mock_call_ollama.return_value = '{"required": ["python"], "preferred": []}'
        extractor.extract_job_requirements("same job")
        extractor.extract_job_requirements("same job", force=True)
        assert extractor._mock_call_ollama.call_count == 2

    def test_cache_file_written(self, extractor, tmp_path):
        extractor._mock_call_ollama.return_value = '{"required": ["scala"], "preferred": ["spark"]}'
        extractor.extract_job_requirements("scala data engineer")
        cache_files = list((tmp_path / "jobs").glob("*.json"))
        assert len(cache_files) == 1
        saved = json.loads(cache_files[0].read_text())
        assert "scala" in saved["required"]

    def test_empty_cache_triggers_re_extraction(self, extractor, tmp_path):
        # Write a cache file that contains empty lists → should re-extract
        from matcher.utils import stable_hash
        job_text = "python backend role"
        cache_path = tmp_path / "jobs" / f"{stable_hash(job_text, length=32)}_requirements.json"
        cache_path.parent.mkdir(parents=True, exist_ok=True)
        cache_path.write_text('{"required": [], "preferred": []}')

        extractor._mock_call_ollama.return_value = '{"required": ["python"], "preferred": []}'
        result = extractor.extract_job_requirements(job_text)
        extractor._mock_call_ollama.assert_called_once()
        assert "python" in result["required"]
