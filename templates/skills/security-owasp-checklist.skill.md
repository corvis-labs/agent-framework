---
name: security-owasp-checklist
description: OWASP-aligned security test coverage checklist and severity classification scale for web, API, and cloud-native applications. Invoke via /acli.checklist during security reviews.
---

# Security OWASP Checklist Skill

## When to Use
Invoke this skill when performing a security review, generating security gates for a feature, or verifying test coverage against OWASP Top 10 (2021).

## Severity Classification Scale

| Severity | Examples |
|----------|---------|
| **Critical** | Remote code execution, authentication bypass, SQL injection with data access |
| **High** | Stored XSS, IDOR with sensitive data exposure, privilege escalation |
| **Medium** | CSRF on state-changing actions, missing security headers, verbose error messages |
| **Low** | Clickjacking on non-sensitive pages, minor information disclosure |
| **Informational** | Best-practice deviations, defence-in-depth improvements |

Every finding **must** include: severity rating, proof of exploitability, and copy-paste-ready remediation code.

## Security Test Coverage Checklist

Run through all categories below. Mark `[x]` when covered by an automated test or manual verification.

### Authentication
- [ ] Missing / absent token is rejected (401)
- [ ] Expired token is rejected (401)
- [ ] Algorithm confusion (e.g. RS256 → HS256 downgrade) is blocked
- [ ] Wrong issuer / audience in JWT is rejected

### Authorization
- [ ] IDOR — user A cannot access user B's resources
- [ ] Horizontal privilege escalation across roles
- [ ] Mass assignment — hidden fields not accepted
- [ ] Vertical privilege escalation (user → admin)

### Input Validation
- [ ] Boundary values and off-by-one inputs handled
- [ ] Special characters (`<`, `>`, `"`, `'`, `;`, `--`, `\0`) sanitised
- [ ] Oversized payloads rejected with 413 / appropriate error
- [ ] Unexpected or extra fields in request body ignored or rejected

### Injection
- [ ] SQL injection (parameterised queries or ORM used throughout)
- [ ] Stored and reflected XSS — output encoding in place
- [ ] Command injection — no `exec(userInput)` patterns
- [ ] SSRF — outbound requests restricted to allowlist
- [ ] Path traversal — `../` sequences normalised and blocked
- [ ] Template injection — user input never rendered in server-side templates

### Security Headers
- [ ] `Content-Security-Policy` (nonce-based preferred)
- [ ] `Strict-Transport-Security` with `includeSubDomains`
- [ ] `X-Content-Type-Options: nosniff`
- [ ] `X-Frame-Options: DENY` or `SAMEORIGIN`
- [ ] `Permissions-Policy` restricts unused browser features
- [ ] `CORS` policy limited to known origins

### Rate Limiting & Brute Force
- [ ] Login endpoint rate-limited (≤ 5–10 attempts / minute)
- [ ] Password-reset and OTP endpoints rate-limited
- [ ] API endpoints rate-limited per authenticated user

### Error Handling
- [ ] No stack traces in production responses
- [ ] Auth errors return generic messages (no "user not found" vs "wrong password")
- [ ] No debug endpoints (`/debug`, `/__debug__`, etc.) reachable in production

### Session Security
- [ ] Session cookie flags: `HttpOnly`, `Secure`, `SameSite=Strict` or `Lax`
- [ ] Session invalidated on logout (server-side)
- [ ] Session invalidated after password change
- [ ] Session ID rotated after privilege elevation

### Business Logic
- [ ] Race conditions (TOCTOU) tested under concurrent requests
- [ ] Negative / zero values rejected where invalid
- [ ] Workflow bypass — steps cannot be skipped out-of-order
- [ ] Price / quantity manipulation blocked server-side

### File Uploads
- [ ] Executable file types (`.exe`, `.sh`, `.php`, etc.) rejected
- [ ] Magic byte validation (not just extension check)
- [ ] File size limits enforced
- [ ] Filename sanitised — no path traversal via filename
- [ ] Uploaded files served from isolated origin / CDN, not the app origin

## OWASP Top 10 (2021) Mapping

| # | Category | Key Test |
|---|----------|---------|
| A01 | Broken Access Control | IDOR, privilege escalation, CORS misconfig |
| A02 | Cryptographic Failures | Weak TLS, plaintext secrets, weak hashing |
| A03 | Injection | SQLi, XSS, CMDi, template injection |
| A04 | Insecure Design | Threat model gaps, missing rate limits |
| A05 | Security Misconfiguration | Default creds, open cloud storage, verbose errors |
| A06 | Vulnerable Components | CVEs in dependencies, outdated packages |
| A07 | Auth & Session Failures | Weak passwords, missing MFA, session fixation |
| A08 | Software & Data Integrity | Unsigned updates, insecure deserialization |
| A09 | Logging & Monitoring Failures | No audit log, no alerting on suspicious events |
| A10 | SSRF | Unvalidated outbound requests |

## Output Format

Generate a checklist file at `.specify/specs/{feature}/checklists/security.md` using this structure:

```markdown
# Security Checklist — {Feature Name}

Generated: {date}  
Reviewer: Security Engineer  

## Coverage Summary
| Category | Items | Status |
|----------|-------|--------|
| Authentication | N | ☐ Incomplete |

## Findings
### Critical
...
### High
...

## Checklist Items
[paste relevant items from above, marked complete/incomplete]
```
