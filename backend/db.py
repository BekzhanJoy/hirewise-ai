import json
import os
import re
import secrets
import shutil
from pathlib import Path
from typing import Dict, List, Optional, Any
from uuid import uuid4
from datetime import datetime
from cryptography.hazmat.primitives.kdf.scrypt import Scrypt

DATA_DIR = Path.cwd().parent.parent / "local-data"
UPLOADS_DIR = DATA_DIR / "uploads"
DB_FILE = DATA_DIR / "db.json"

def default_db() -> Dict[str, List[Any]]:
    return {
        "users": [],
        "profiles": [],
        "user_settings": [],
        "resumes": [],
        "scan_results": [],
    }

def ensure_local_storage():
    os.makedirs(UPLOADS_DIR, exist_ok=True)
    if not DB_FILE.exists():
        with open(DB_FILE, "w") as f:
            json.dump(default_db(), f, indent=2)

def read_db():
    ensure_local_storage()
    with open(DB_FILE, "r") as f:
        return json.load(f)

def write_db(db):
    ensure_local_storage()
    with open(DB_FILE, "w") as f:
        json.dump(db, f, indent=2)

def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16).hex()
    kdf = Scrypt(salt=bytes.fromhex(salt), length=64, n=2**14, r=8, p=1)
    derived = kdf.derive(password.encode())
    return f"{salt}:{derived.hex()}"

def verify_password(password: str, password_hash: str) -> bool:
    try:
        salt_hex, stored_hex = password_hash.split(":", 1)
        salt = bytes.fromhex(salt_hex)
        kdf = Scrypt(salt=salt, length=64, n=2**14, r=8, p=1)
        derived = kdf.derive(password.encode())
        stored = bytes.fromhex(stored_hex)
        return secrets.compare_digest(stored, derived)
    except:
        return False

def to_client_user(user):
    return {
        "id": user["id"],
        "email": user["email"],
        "user_metadata": {
            "full_name": user["full_name"],
        },
    }

def create_user(email: str, password: str, full_name: str):
    normalized_email = email.strip().lower()
    db = read_db()
    if any(u["email"] == normalized_email for u in db["users"]):
        raise ValueError("User with this email already exists")
    now = datetime.now().isoformat()
    uid = str(uuid4())
    pwd_hash = hash_password(password)
    user = {
        "id": uid,
        "email": normalized_email,
        "password_hash": pwd_hash,
        "full_name": full_name.strip(),
        "created_at": now,
    }
    profile = {
        "id": uid,
        "email": normalized_email,
        "full_name": full_name.strip(),
        "created_at": now,
        "updated_at": now,
    }
    settings = {
        "user_id": uid,
        "auto_save_resumes": True,
        "color_scheme": "emerald",
        "language": "en",
        "max_storage_mb": 500,
        "created_at": now,
        "updated_at": now,
    }
    db["users"].append(user)
    db["profiles"].append(profile)
    db["user_settings"].append(settings)
    write_db(db)
    return to_client_user(user)

def authenticate_user(email: str, password: str):
    normalized_email = email.strip().lower()
    db = read_db()
    user = next((u for u in db["users"] if u["email"] == normalized_email), None)
    if not user or not verify_password(password, user["password_hash"]):
        raise ValueError("Invalid email or password")
    return to_client_user(user)

def get_profile(user_id: str):
    db = read_db()
    return next((p for p in db["profiles"] if p["id"] == user_id), None)

def get_settings(user_id: str):
    db = read_db()
    return next((s for s in db["user_settings"] if s["user_id"] == user_id), None)

def sanitize_name(name: str):
    return re.sub(r'[^a-zA-Z0-9._-]', '_', name)

def placeholder_extracted_text(file_name: str):
    return f"[Extracted text from {file_name}]\\n\\nCandidate Name: Local Candidate\\nEmail: candidate@example.com\\nPhone: +1 555 123 4567\\n\\nSummary:\\nExperienced specialist with strong communication, organization, and problem-solving skills.\\n\\nSkills:\\nCommunication, Leadership, Teamwork, Project Management, Analytical Thinking"

def save_resume_from_file(user_id: str, file_path: str, file_name: str, file_type: str, file_size: int):
    db = read_db()
    ext = Path(file_name).suffix or ''
    stored_name = f"{int(datetime.now().timestamp())}-{str(uuid4())}{ext}"
    user_dir = UPLOADS_DIR / user_id
    user_dir.mkdir(parents=True, exist_ok=True)
    stored_path = user_dir / sanitize_name(stored_name)
    shutil.copy2(file_path, stored_path)

    if file_type == 'text/plain':
        with open(stored_path, 'r') as f:
            extracted_text = f.read()
    else:
        extracted_text = placeholder_extracted_text(file_name)

    resume = {
        "id": str(uuid4()),
        "user_id": user_id,
        "file_name": file_name,
        "file_url": f"/api/files/{user_id}/{stored_name}",
        "file_type": file_type,
        "file_size": file_size,
        "extracted_text": extracted_text,
        "stored_name": stored_name,
        "created_at": datetime.now().isoformat(),
    }
    db["resumes"].append(resume)
    write_db(db)
    return resume

def list_resumes(user_id: str):
    db = read_db()
    resumes = [r for r in db["resumes"] if r["user_id"] == user_id]
    results = []
    for resume in resumes:
        scans = [s for s in db["scan_results"] if s["resume_id"] == resume["id"]]
        best_match_score = max([s["match_score"] for s in scans], default=-1) if scans else None
        results.append({**resume, "best_match_score": best_match_score})
    results.sort(key=lambda x: datetime.fromisoformat(x["created_at"]), reverse=True)
    return results

def delete_resume(user_id: str, resume_id: str):
    db = read_db()
    resume = next((r for r in db["resumes"] if r["id"] == resume_id and r["user_id"] == user_id), None)
    if not resume:
        raise ValueError("Resume not found")
    file_path = UPLOADS_DIR / user_id / resume["stored_name"]
    if file_path.exists():
        file_path.unlink()
    db["resumes"] = [r for r in db["resumes"] if r["id"] != resume_id]
    db["scan_results"] = [s for s in db["scan_results"] if s["resume_id"] != resume_id]
    write_db(db)

def scan_resumes(user_id: str, keywords: List[str]):
    db = read_db()
    resumes = [r for r in db["resumes"] if r["user_id"] == user_id]
    if not resumes:
        return []
    best_resume_id = ""
    best_score = -1
    batch = []
    for resume in resumes:
        text = resume["extracted_text"] or ""
        matched_keywords = [k for k in keywords if text.lower().find(k.lower()) != -1]
        score = round((len(matched_keywords) / len(keywords)) * 100) if keywords else 0
        if score > best_score:
            best_score = score
            best_resume_id = resume["id"]
        batch.append({"resume": resume, "matched_keywords": matched_keywords, "score": score})
    now = datetime.now().isoformat()
    saved = []
    for item in batch:
        record = {
            "id": str(uuid4()),
            "user_id": user_id,
            "resume_id": item["resume"]["id"],
            "keywords": keywords,
            "match_score": item["score"],
            "matched_keywords": item["matched_keywords"],
            "is_best_match": item["resume"]["id"] == best_resume_id,
            "created_at": now,
        }
        db["scan_results"].append(record)
        saved.append({
            "id": record["id"],
            "resumeId": item["resume"]["id"],
            "fileName": item["resume"]["file_name"],
            "fileType": item["resume"]["file_type"],
            "matchScore": item["score"],
            "matchedKeywords": item["matched_keywords"],
            "isBestMatch": record["is_best_match"],
        })
    write_db(db)
    saved.sort(key=lambda x: x["matchScore"], reverse=True)
    return saved

def get_dashboard(user_id: str):
    db = read_db()
    resumes = [r for r in db["resumes"] if r["user_id"] == user_id]
    scans = [s for s in db["scan_results"] if s["user_id"] == user_id]
    recent_scans = sorted(scans, key=lambda s: datetime.fromisoformat(s["created_at"]), reverse=True)[:5]
    recent_scans = [
        {
            **s,
            "resumes": next(({"id": r["id"], "file_name": r["file_name"], "created_at": r["created_at"]} for r in db["resumes"] if r["id"] == s["resume_id"]), None)
        }
        for s in recent_scans
    ]
    return {
        "stats": {
            "resumesScanned": len(resumes),
            "keywordsMatched": len(scans),
            "bestMatches": len([s for s in scans if s["is_best_match"]]),
        },
        "recentScans": recent_scans,
    }

def read_stored_file(slug: List[str]):
    file_path = UPLOADS_DIR / Path(*slug)
    if not file_path.exists():
        raise ValueError("File not found")
    return file_path.read_bytes()

def save_profile_and_settings(user_id: str, profile_input: Dict[str, Any], settings_input: Dict[str, Any]):
    db = read_db()
    now = datetime.now().isoformat()
    profile = next((p for p in db["profiles"] if p["id"] == user_id), None)
    if profile:
        profile["full_name"] = profile_input.get("full_name", profile["full_name"])
        profile["updated_at"] = now
    user = next((u for u in db["users"] if u["id"] == user_id), None)
    if user and "full_name" in profile_input:
        user["full_name"] = profile_input["full_name"]
    settings = next((s for s in db["user_settings"] if s["user_id"] == user_id), None)
    if settings:
        settings.update({
            "auto_save_resumes": settings_input.get("auto_save_resumes", settings["auto_save_resumes"]),
            "color_scheme": settings_input.get("color_scheme", settings["color_scheme"]),
            "language": settings_input.get("language", settings["language"]),
            "max_storage_mb": settings_input.get("max_storage_mb", settings["max_storage_mb"]),
            "updated_at": now,
        })
    else:
        settings = {
            "user_id": user_id,
            "auto_save_resumes": settings_input.get("auto_save_resumes", True),
            "color_scheme": settings_input.get("color_scheme", "emerald"),
            "language": settings_input.get("language", "en"),
            "max_storage_mb": settings_input.get("max_storage_mb", 500),
            "created_at": now,
            "updated_at": now,
        }
        db["user_settings"].append(settings)
    write_db(db)
    return get_profile(user_id), get_settings(user_id)

def update_account(user_id: str, input_data: Dict[str, Any]):
    db = read_db()
    user_idx = next((i for i, u in enumerate(db["users"]) if u["id"] == user_id), -1)
    if user_idx == -1:
        raise ValueError("User not found")
    user = db["users"][user_idx]
    profile_idx = next((i for i, p in enumerate(db["profiles"]) if p["id"] == user_id), -1)
    next_email = (input_data.get("email") or user["email"]).strip().lower()
    next_full_name = (input_data.get("full_name") or user["full_name"]).strip()
    wants_email_change = next_email != user["email"]
    wants_pwd_change = "new_password" in input_data
    if wants_email_change or wants_pwd_change:
        if not input_data.get("current_password"):
            raise ValueError("Current password required for changes")
        if not verify_password(input_data["current_password"], user["password_hash"]):
            raise ValueError("Current password incorrect")
    if wants_email_change and any(u["email"] == next_email for i, u in enumerate(db["users"]) if i != user_idx):
        raise ValueError("Email already exists")
    if wants_pwd_change and len(input_data["new_password"]) < 6:
        raise ValueError("Password min 6 chars")
    user["email"] = next_email
    user["full_name"] = next_full_name
    if wants_pwd_change:
        user["password_hash"] = hash_password(input_data["new_password"])
    if profile_idx != -1:
        db["profiles"][profile_idx].update({
            "email": next_email,
            "full_name": next_full_name,
            "updated_at": datetime.now().isoformat(),
        })
    write_db(db)
    return get_profile(user_id), to_client_user(user)
