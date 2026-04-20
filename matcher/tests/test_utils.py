"""Tests for matcher.utils"""
import pytest
from matcher.utils import (
    stable_hash,
    normalize_text,
    extract_first_json_object,
    parse_llm_json,
    coerce_requirements,
)


class TestStableHash:
    def test_deterministic(self):
        assert stable_hash("hello") == stable_hash("hello")

    def test_different_inputs_differ(self):
        assert stable_hash("hello") != stable_hash("world")

    def test_length_respected(self):
        h = stable_hash("test", length=16)
        assert len(h) == 16

    def test_minimum_length_enforced(self):
        # length=2 should be clamped to minimum 8
        h = stable_hash("test", length=2)
        assert len(h) == 8

    def test_none_input(self):
        # should not raise
        h = stable_hash(None)
        assert isinstance(h, str)

    def test_empty_string(self):
        h = stable_hash("")
        assert isinstance(h, str)
        assert len(h) >= 8

    def test_algo_md5(self):
        h = stable_hash("test", algo="md5", length=32)
        assert len(h) == 32

    def test_algo_sha1(self):
        h = stable_hash("test", algo="sha1", length=20)
        assert len(h) == 20


class TestNormalizeText:
    def test_lowercases(self):
        assert normalize_text("Python") == "python"

    def test_strips_whitespace(self):
        assert normalize_text("  hello  ") == "hello"

    def test_collapses_inner_whitespace(self):
        assert normalize_text("hello   world") == "hello world"

    def test_unicode_normalization(self):
        # NFKC: ligature fi → fi
        assert normalize_text("\ufb01le") == "file"

    def test_empty_string(self):
        assert normalize_text("") == ""

    def test_none_returns_empty(self):
        assert normalize_text(None) == ""


class TestExtractFirstJsonObject:
    def test_plain_json(self):
        result = extract_first_json_object('{"a": 1}')
        assert result == {"a": 1}

    def test_json_in_code_fence(self):
        raw = '```json\n{"required": ["python"]}\n```'
        result = extract_first_json_object(raw)
        assert result == {"required": ["python"]}

    def test_json_with_surrounding_text(self):
        raw = 'Here is the result: {"key": "value"} done.'
        result = extract_first_json_object(raw)
        assert result == {"key": "value"}

    def test_think_blocks_stripped(self):
        raw = "<think>reasoning here</think>\n{\"x\": 1}"
        result = extract_first_json_object(raw)
        assert result == {"x": 1}

    def test_returns_none_for_no_json(self):
        assert extract_first_json_object("no json here") is None

    def test_returns_none_for_empty(self):
        assert extract_first_json_object("") is None

    def test_returns_none_for_json_array(self):
        # We only want dicts
        assert extract_first_json_object("[1, 2, 3]") is None


class TestParseLlmJson:
    def test_valid_with_required_keys(self):
        raw = '{"required": ["python"], "preferred": ["docker"]}'
        result = parse_llm_json(raw, required_keys={"required", "preferred"})
        assert result is not None
        assert result["required"] == ["python"]

    def test_missing_required_key_returns_none(self):
        raw = '{"required": ["python"]}'
        result = parse_llm_json(raw, required_keys={"required", "preferred"})
        assert result is None

    def test_no_required_keys_check(self):
        raw = '{"anything": true}'
        result = parse_llm_json(raw)
        assert result == {"anything": True}

    def test_invalid_json_returns_none(self):
        assert parse_llm_json("not json at all") is None


class TestCoerceRequirements:
    def test_basic(self):
        obj = {"required": ["Python", "FastAPI"], "preferred": ["Docker"]}
        result = coerce_requirements(obj)
        assert result["required"] == ["python", "fastapi"]
        assert result["preferred"] == ["docker"]

    def test_deduplication(self):
        obj = {"required": ["Python", "python", "PYTHON"], "preferred": []}
        result = coerce_requirements(obj)
        assert result["required"] == ["python"]

    def test_filters_empty_strings(self):
        obj = {"required": ["", "  ", "python"], "preferred": []}
        result = coerce_requirements(obj)
        assert result["required"] == ["python"]

    def test_non_list_values_become_empty(self):
        obj = {"required": "python", "preferred": None}
        result = coerce_requirements(obj)
        assert result["required"] == []
        assert result["preferred"] == []

    def test_empty_input(self):
        result = coerce_requirements({})
        assert result == {"required": [], "preferred": []}
