# MarrowQ — Security, Cryptography & RBAC Audit Report

**Project:** MarrowQ Precision Medicine Platform  
**Compliance Scope:** OWASP Top 10, NIST SP 800-63B, HIPAA Technical Safeguards  
**Verification Date:** October 31, 2026  
**Audit Status:** PASSED (100% Core Security Tests Passing)  

---

## 1. Authentication & Cryptographic Architecture

### 1.1 Password Storage & Derivation
- **Standard:** NIST SP 800-63B / OWASP Password Storage Cheat Sheet.
- **Algorithm:** PBKDF2-HMAC-SHA256 with **600,000 iterations**.
- **Salt Generation:** 16 bytes (128 bits) of cryptographically secure pseudo-random data per user via `secrets.token_hex(16)`.
- **Timing Attack Resistance:** Hash verification employs constant-time string comparison via `hmac.compare_digest()`.

### 1.2 JWT Bearer Token Lifecycle
- **Implementation:** PyJWT (RFC 7519) with HMAC-SHA256 (`HS256`).
- **Standard Claims:** `sub` (User ID), `email`, `role`, `full_name`, `iat` (issued at), and `exp` (expiration).
- **Session Duration:** 24 hours (`ACCESS_TOKEN_EXPIRE_HOURS = 24`).
- **Revocation & Expiry:** Enforces strict signature validation and automatic rejection of expired tokens with HTTP 401 Unauthorized responses.

---

## 2. Role-Based Access Control (RBAC) Specification

MarrowQ implements four distinct clinical roles with principle-of-least-privilege enforcement:

| Role | Access Scope | Prohibited Actions |
| :--- | :--- | :--- |
| **`doctor`** | View patient clinical records, order diagnostic modules, review PGx contraindications, formulate conditioning plans, countersign reports. | Cannot access raw QPU pulse calibrations or modify system audit logs. |
| **`researcher`**| Run quantum-classical benchmarks, view de-identified cohort analytics, execute kernel diagnostics, inspect Gram matrix spectra. | Cannot view identifiable patient records or counter-sign clinical plans. |
| **`patient`** | View personalized blood count trajectory (ANC/Platelets), milestone checklists, and verified patient-friendly educational summaries. | Cannot modify clinical records, view unverified toxicities, or submit QPU jobs. |
| **`admin`** | User management, security audit log access, backend configuration, emergency system override. | Restricted by audit trails on all administrative actions. |

### Enforced RBAC Route Guard:
```python
def require_role(allowed_roles: List[str]):
    def role_checker(current_user: Dict[str, Any] = Depends(get_current_user)):
        user_role = current_user.get("role", "guest")
        if user_role not in allowed_roles and user_role != "admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied: Role '{user_role}' lacks required permissions."
            )
        return current_user
    return role_checker
```

---

## 3. Secret Management & Telemetry Sanitization

1. **Environment Secrets Protection:**
   - Secrets (`IBM_QUANTUM_API_KEY`, `JWT_SECRET_KEY`) reside exclusively in local `.env` and environment variables.
   - `.env` is explicitly registered in `.gitignore` and excluded from source control.
2. **QPU Token Masking in Logs & Exceptions:**
   - Exception handlers intercept error messages from IBM Cloud/IAM and replace raw tokens with masked variants (`••••••••••••`).
   - Hardware status endpoints (`/api/quantum/status`) expose only operational telemetry, backend names, and queue statistics, never private API credentials.

---

## 4. Audit Log & Data Integrity Controls

- Every clinical milestone, conditioning recommendation, and lab observation records the author or countersigning physician (`verified_by` and timestamp).
- Demonstration datasets and synthetic patients explicitly carry `is_synthetic: true` to prevent data conflation in real-world environments.
- Zero client-side trust: all risk calculations, survival estimations, and drug contraindications are recomputed and validated on the backend.
