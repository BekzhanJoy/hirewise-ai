import base64
import hashlib
import json
import os
from pathlib import Path
from typing import Any

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

KEY_ENV_VAR = "HIREWISE_ENCRYPTION_KEY"
KEY_FILE_NAME = ".secret.key"
JSON_ENCRYPTION_VERSION = 1
BLOB_MAGIC = b"HWENC1\0"
NONCE_SIZE = 12


def _key_file(data_dir: Path) -> Path:
    return data_dir / KEY_FILE_NAME


def _normalize_key(raw_value: str) -> bytes:
    value = (raw_value or "").strip()
    if not value:
        raise ValueError("Encryption key is empty")

    try:
        decoded = base64.urlsafe_b64decode(value.encode("utf-8"))
        if len(decoded) == 32:
            return decoded
    except Exception:
        pass

    # Fallback: derive a fixed 32-byte key from an arbitrary passphrase/string.
    return hashlib.sha256(value.encode("utf-8")).digest()


def generate_key() -> str:
    return base64.urlsafe_b64encode(os.urandom(32)).decode("utf-8")


def load_or_create_key(data_dir: Path) -> bytes:
    env_value = os.getenv(KEY_ENV_VAR)
    if env_value:
        return _normalize_key(env_value)

    key_path = _key_file(data_dir)
    key_path.parent.mkdir(parents=True, exist_ok=True)
    if key_path.exists():
        return _normalize_key(key_path.read_text(encoding="utf-8"))

    created = generate_key()
    key_path.write_text(created, encoding="utf-8")
    return _normalize_key(created)


def encrypt_json_payload(data: Any, key: bytes) -> dict[str, Any]:
    aesgcm = AESGCM(key)
    nonce = os.urandom(NONCE_SIZE)
    plaintext = json.dumps(data, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    ciphertext = aesgcm.encrypt(nonce, plaintext, None)
    return {
        "encrypted": True,
        "version": JSON_ENCRYPTION_VERSION,
        "alg": "AES-256-GCM",
        "nonce": base64.b64encode(nonce).decode("utf-8"),
        "ciphertext": base64.b64encode(ciphertext).decode("utf-8"),
    }


def is_encrypted_json_payload(payload: Any) -> bool:
    return isinstance(payload, dict) and payload.get("encrypted") is True and "ciphertext" in payload and "nonce" in payload


def decrypt_json_payload(payload: dict[str, Any], key: bytes) -> Any:
    aesgcm = AESGCM(key)
    nonce = base64.b64decode(payload["nonce"])
    ciphertext = base64.b64decode(payload["ciphertext"])
    plaintext = aesgcm.decrypt(nonce, ciphertext, None)
    return json.loads(plaintext.decode("utf-8"))


def is_encrypted_blob(data: bytes) -> bool:
    return bool(data) and data.startswith(BLOB_MAGIC)


def encrypt_blob(data: bytes, key: bytes) -> bytes:
    aesgcm = AESGCM(key)
    nonce = os.urandom(NONCE_SIZE)
    ciphertext = aesgcm.encrypt(nonce, data, None)
    return BLOB_MAGIC + nonce + ciphertext


def decrypt_blob(data: bytes, key: bytes) -> bytes:
    if not is_encrypted_blob(data):
        return data
    aesgcm = AESGCM(key)
    nonce = data[len(BLOB_MAGIC): len(BLOB_MAGIC) + NONCE_SIZE]
    ciphertext = data[len(BLOB_MAGIC) + NONCE_SIZE:]
    return aesgcm.decrypt(nonce, ciphertext, None)
