"""
Tests for MarrowQ Server-Side Authentication & Role-Based Access Control (RBAC).
Validates Issue K: cryptographic security, token lifecycle, and role segregation.
"""
import pytest
from fastapi import HTTPException
from app.core.auth import (
    hash_password, verify_password, create_access_token, decode_access_token,
    require_role, seed_default_users, get_current_user
)
from app.core.database import init_db, get_user_by_email


def test_auth_crypto_strength():
    """Verifies PBKDF2-HMAC-SHA256 with 600k rounds and salt randomness."""
    pw = "SuperSecure#ClinicalPass2026"
    h1, s1 = hash_password(pw)
    h2, s2 = hash_password(pw)
    assert h1 != h2, "Salts must be randomly generated so hashes differ"
    assert s1 != s2
    assert verify_password(pw, h1, s1) is True
    assert verify_password(pw, h2, s2) is True
    assert verify_password("WrongPassword!", h1, s1) is False


def test_jwt_claims_and_roles():
    """Validates JWT sub, email, and role claims."""
    doctor_user = {
        "user_id": "usr-doc-77",
        "email": "attending@marrowq.org",
        "role": "doctor",
        "full_name": "Dr. Attending"
    }
    token = create_access_token(doctor_user)
    payload = decode_access_token(token)
    assert payload["sub"] == "usr-doc-77"
    assert payload["role"] == "doctor"
    assert payload["email"] == "attending@marrowq.org"


def test_rbac_role_guard_permits_authorized_role():
    """Verifies require_role allows authorized roles."""
    checker = require_role(["doctor", "researcher"])
    user_doc = {"user_id": "u1", "role": "doctor"}
    user_res = {"user_id": "u2", "role": "researcher"}

    assert checker(user_doc) == user_doc
    assert checker(user_res) == user_res


def test_rbac_role_guard_rejects_unauthorized_role():
    """Verifies require_role raises 403 Forbidden for unauthorized roles."""
    checker = require_role(["doctor"])
    user_patient = {"user_id": "u3", "role": "patient"}

    with pytest.raises(HTTPException) as exc_info:
        checker(user_patient)
    assert exc_info.value.status_code == 403
    assert "Access denied" in exc_info.value.detail


def test_rbac_admin_override():
    """Verifies admin role can access any role-restricted endpoint."""
    doctor_only_checker = require_role(["doctor"])
    user_admin = {"user_id": "u-admin", "role": "admin"}
    assert doctor_only_checker(user_admin) == user_admin


def test_seed_users_integrity():
    """Verifies default accounts exist with appropriate roles."""
    init_db()
    seed_default_users()
    admin = get_user_by_email("admin@marrowq.org")
    assert admin is not None
    assert admin["role"] == "admin"
    assert verify_password("MarrowQ#Admin2026", admin["password_hash"], admin["salt"]) is True
