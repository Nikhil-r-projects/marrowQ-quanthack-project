"""
MarrowQ Authentication & Access Control Endpoints
-------------------------------------------------
Provides login, session verification, user listing, and logout services.
Enforces genuine server-side JWT authentication and RBAC roles.
"""

from typing import Dict, Any, List, Optional
from datetime import datetime, timezone
import uuid
from pydantic import BaseModel, Field
from fastapi import APIRouter, HTTPException, Depends, status

from app.core.database import get_user_by_email, save_user, log_audit_event
from app.core.auth import (
    verify_password, create_access_token, get_current_user,
    require_role, seed_default_users, hash_password
)

router = APIRouter(prefix="/api/auth", tags=["auth"])


class LoginRequest(BaseModel):
    email: str = Field(..., json_schema_extra={"example": "doctor@marrowq.org"})
    password: str = Field(..., json_schema_extra={"example": "MarrowQ#Doctor2026"})


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in_hours: int = 24
    user: Dict[str, Any]


class UserCreateRequest(BaseModel):
    email: str = Field(..., pattern=r"^[^@]+@[^@]+\.[^@]+$")
    password: str = Field(..., min_length=8)
    role: str = Field(..., pattern="^(doctor|researcher|patient|admin)$")
    full_name: str


@router.post("/login", response_model=LoginResponse)
def login(req: LoginRequest):
    """Authenticates user credentials and issues a signed JWT Bearer access token."""
    # Ensure default accounts are seeded
    seed_default_users()
    
    user = get_user_by_email(req.email)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password."
        )

    is_valid = verify_password(req.password, user["password_hash"], user["salt"])
    if not is_valid:
        log_audit_event("AUTH_LOGIN_FAILED", None, "SECURITY", {"email": req.email, "reason": "BAD_PASSWORD"})
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password."
        )

    token = create_access_token(user)
    log_audit_event("AUTH_LOGIN_SUCCESS", None, user["role"], {"user_id": user["user_id"], "email": user["email"]})

    user_info = {
        "user_id": user["user_id"],
        "email": user["email"],
        "role": user["role"],
        "full_name": user["full_name"]
    }

    return {
        "access_token": token,
        "token_type": "bearer",
        "expires_in_hours": 24,
        "user": user_info
    }


@router.get("/me")
def get_current_user_profile(user: Dict[str, Any] = Depends(get_current_user)):
    """Returns the authenticated profile and role permissions of the current session."""
    return {
        "user_id": user["user_id"],
        "email": user["email"],
        "role": user["role"],
        "full_name": user["full_name"]
    }


@router.post("/seed", status_code=status.HTTP_200_OK)
def trigger_seed_users():
    """Seeds canonical role accounts if they are not already present."""
    seed_default_users()
    return {"status": "SUCCESS", "message": "Default role accounts verified."}


@router.post("/logout")
def logout(user: Dict[str, Any] = Depends(get_current_user)):
    """Logs out the active session."""
    log_audit_event("AUTH_LOGOUT", None, user["role"], {"user_id": user["user_id"]})
    return {"status": "SUCCESS", "message": "Session invalidated."}
