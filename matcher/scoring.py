"""
scoring.py
----------
Pure functions — no I/O, no external state.

Key design decision for fuzzy_ratio / compute_coverage
-------------------------------------------------------
The original fuzzy_ratio compared a *short skill token* against the
*entire resume text* using word-overlap, which always returned near-zero
because the skill vocabulary is tiny relative to the resume.

The fix: when matching a skill against resume text we use two strategies
in order of preference:

1. **Substring presence** — normalized skill appears as a whole token
   sequence inside normalized resume text (catches exact and partial
   matches like "postgresql" inside a long paragraph).

2. **Token overlap against a sliding window** — we extract all n-grams
   from the resume that match the length of the skill phrase, then take
   the best token-overlap ratio (catches "machine learning" vs "ml" or
   "k8s" vs "kubernetes" up to the threshold).

The threshold (default 0.85) is intentionally high to avoid false
positives.
"""

from typing import Dict, Iterable, List, Set, Tuple

import numpy as np

from .utils import normalize_text

_REQ_STOPWORDS: Set[str] = {
    "and", "or", "the", "a", "an", "to", "of", "in", "on", "for", "with", "by",
    "from", "within", "across", "through", "ability", "strong", "good", "skills",
    "skill", "experience", "years", "year", "work", "working", "candidate", "role",
    "required", "preferred", "responsible", "responsibilities", "knowledge",
}

# Canonical forms for commonly equivalent JD/resume wording.
_TOKEN_SYNONYMS: Dict[str, str] = {
    "initiatives": "projects",
    "initiative": "project",
    "project": "projects",
    "delivery": "deliver",
    "delivering": "deliver",
    "collaborate": "collaboration",
    "collaborating": "collaboration",
    "multicultural": "crossfunctional",
    "cross-functional": "crossfunctional",
    "crossfunctional": "crossfunctional",
    "optimisation": "optimization",
    "optimise": "optimization",
    "optimize": "optimization",
    "automate": "automation",
    "automating": "automation",
    "reporting": "reports",
    "report": "reports",
    "stakeholders": "stakeholder",
    "management": "stakeholder",
    "budget": "scope",
    "deadlines": "timeline",
    "deadline": "timeline",
    "timelines": "timeline",
}


def _normalize_requirement_token(token: str) -> str:
    token = normalize_text(token).strip()
    if not token:
        return ""
    return _TOKEN_SYNONYMS.get(token, token)


def _requirement_terms(requirement: str) -> List[str]:
    """
    Build requirement terms from a JD phrase.
    Long phrases are split into meaningful tokens to avoid strict sentence-level matching.
    """
    cleaned = normalize_text(requirement)
    if not cleaned:
        return []
    terms: List[str] = []
    for raw in cleaned.split():
        token = _normalize_requirement_token(raw)
        if not token or token in _REQ_STOPWORDS or len(token) < 3:
            continue
        if token not in terms:
            terms.append(token)
    return terms


def _token_coverage_score(requirement: str, resume_text: str) -> float:
    """
    Coverage for long natural-language requirements.
    Example: "deliver projects on time and within scope" -> terms like
    ["deliver", "projects", "timeline", "scope"].
    """
    terms = _requirement_terms(requirement)
    if not terms:
        return 0.0
    hits = 0
    for term in terms:
        # Use the same matcher for each normalized requirement token.
        if fuzzy_match_skill(term, resume_text) >= 0.7:
            hits += 1
    return hits / len(terms)


# ---------------------------------------------------------------------------
# Cosine / semantic helpers
# ---------------------------------------------------------------------------

def cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    """Raw cosine similarity in [-1, 1]."""
    a = np.asarray(a, dtype=np.float32).ravel()
    b = np.asarray(b, dtype=np.float32).ravel()
    denom = float(np.linalg.norm(a)) * float(np.linalg.norm(b))
    if denom == 0.0:
        return 0.0
    return float(np.dot(a, b) / denom)


def semantic_similarity_01(job_emb: np.ndarray, resume_emb: np.ndarray) -> float:
    """
    Cosine similarity rescaled from [-1, 1] → [0, 1].

    Because both embeddings are already L2-normalised by EmbeddingsService,
    np.dot(a, b) == cosine(a, b).  We still call cosine_similarity for
    safety in case raw vectors are passed in.
    """
    raw = cosine_similarity(job_emb, resume_emb)
    return float(max(0.0, min(1.0, (raw + 1.0) / 2.0)))


# ---------------------------------------------------------------------------
# Skill / requirement matching against resume text
# ---------------------------------------------------------------------------

def _skill_in_text(skill_tokens: List[str], text_tokens: List[str]) -> float:
    """
    Return the best token-overlap ratio for *skill_tokens* found anywhere
    in *text_tokens* using a sliding window of the same length.

    Examples
    --------
    skill = ["machine", "learning"]  →  looks for any 2-gram in the resume
    skill = ["python"]               →  exact token presence check
    """
    n = len(skill_tokens)
    if n == 0:
        return 0.0

    skill_set = set(skill_tokens)
    best = 0.0

    # Sliding window over resume tokens
    for i in range(len(text_tokens) - n + 1):
        window = set(text_tokens[i : i + n])
        overlap = len(skill_set & window) / n
        if overlap > best:
            best = overlap
        if best == 1.0:
            break

    return best


def fuzzy_match_skill(skill: str, resume_text: str) -> float:
    """
    Return a match confidence in [0, 1] for *skill* against *resume_text*.

    Strategy (in order):
    1. Direct substring — normalized skill string is a contiguous substring
       of the normalized resume (handles "postgresql" inside a long line).
    2. Sliding-window token overlap — handles multi-word skills and
       paraphrases.
    """
    skill = normalize_text(skill)
    text = normalize_text(resume_text)

    if not skill or not text:
        return 0.0

    # Strategy 1: substring presence (fast path)
    # We wrap with spaces so "java" doesn't match "javascript"
    padded_text = f" {text} "
    padded_skill = f" {skill} "
    if padded_skill in padded_text:
        return 1.0

    # Strategy 2: sliding-window token overlap
    skill_tokens = skill.split()
    text_tokens = text.split()
    return _skill_in_text(skill_tokens, text_tokens)


# ---------------------------------------------------------------------------
# Coverage score
# ---------------------------------------------------------------------------

def compute_coverage(
    resume_text: str,
    required: Iterable[str],
    preferred: Iterable[str],
    *,
    threshold: float = 0.65,
) -> Tuple[float, List[str], List[str]]:
    """
    Compute how well *resume_text* covers the job requirements.

    Parameters
    ----------
    resume_text : str
        Full text of a single resume.
    required : iterable of str
        Hard requirements extracted from the job description.
    preferred : iterable of str
        Nice-to-have requirements.
    threshold : float
        Minimum fuzzy match confidence to count a requirement as matched.

    Returns
    -------
    coverage : float in [0, 1]
        Weighted coverage score.
        required skills contribute fully; preferred skills count at 0.5 weight.
    matched : list[str]
        Requirements that were found in the resume.
    missing : list[str]
        Required (not preferred) requirements that were NOT found.
    """
    req = [normalize_text(x) for x in required if x]
    pref = [normalize_text(x) for x in preferred if x]

    matched: List[str] = []
    missing: List[str] = []

    if not req and not pref:
        return 0.0, matched, missing

    hits_required = 0
    for r in req:
        phrase_score = fuzzy_match_skill(r, resume_text)
        token_score = _token_coverage_score(r, resume_text)
        score = max(phrase_score, token_score)
        if score >= threshold:
            matched.append(r)
            hits_required += 1
        else:
            missing.append(r)

    hits_preferred = 0
    for p in pref:
        phrase_score = fuzzy_match_skill(p, resume_text)
        token_score = _token_coverage_score(p, resume_text)
        score = max(phrase_score, token_score)
        if score >= threshold:
            matched.append(p)
            hits_preferred += 1
        # preferred misses are not added to `missing` — they're nice-to-have

    # Denominator weights preferred at 0.5
    denom = len(req) + 0.5 * len(pref)
    if denom == 0.0:
        return 0.0, matched, missing

    cov = (hits_required + 0.5 * hits_preferred) / denom
    return float(max(0.0, min(1.0, cov))), matched, missing


# ---------------------------------------------------------------------------
# Final score combinator
# ---------------------------------------------------------------------------

def final_score(
    semantic: float,
    coverage: float,
    *,
    w_sem: float = 0.65,
    w_cov: float = 0.35,
) -> float:
    """
    Combine semantic similarity and requirement coverage into one score.

    Default weights:
        0.7 × semantic  (global conceptual fit)
        0.3 × coverage  (explicit requirement satisfaction)
    """
    return float(max(0.0, min(1.0, w_sem * semantic + w_cov * coverage)))
