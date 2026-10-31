import pytest
from app.core.auth import (
    hash_password, verify_password, create_access_token, decode_access_token,
    seed_default_users
)
from app.core.database import get_user_by_email, init_db

def test_password_hashing_and_verification():
    raw_pw = "MarrowQ#Doctor2026"
    p_hash, salt = hash_password(raw_pw)
    assert p_hash is not None
    assert len(salt) == 32
    # Verify correct password matches
    assert verify_password(raw_pw, p_hash, salt) is True
    # Verify incorrect password fails
    assert verify_password("WrongPassword123", p_hash, salt) is False


def test_jwt_token_lifecycle():
    user = {
        "user_id": "usr-doctor-001",
        "email": "doctor@marrowq.org",
        "role": "doctor",
        "full_name": "Dr. Varsha Roy"
    }
    token = create_access_token(user)
    assert token is not None
    assert isinstance(token, str)

    payload = decode_access_token(token)
    assert payload["sub"] == "usr-doctor-001"
    assert payload["email"] == "doctor@marrowq.org"
    assert payload["role"] == "doctor"


def test_seed_default_users():
    init_db()
    seed_default_users()
    doc = get_user_by_email("doctor@marrowq.org")
    assert doc is not None
    assert doc["role"] == "doctor"
    assert verify_password("MarrowQ#Doctor2026", doc["password_hash"], doc["salt"]) is True

    res = get_user_by_email("researcher@marrowq.org")
    assert res is not None
    assert res["role"] == "researcher"
    assert verify_password("MarrowQ#Research2026", res["password_hash"], res["salt"]) is True
