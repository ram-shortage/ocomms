# Requirements: OComms v0.2.0 Security Hardening

**Defined:** 2026-01-18
**Core Value:** Data sovereignty — complete control over communication data

## v1 Requirements

Requirements for v0.2.0 milestone. Each maps to roadmap phases.

### Transport Security

- [ ] **SEC-01**: Application serves all traffic over HTTPS with Let's Encrypt auto-renewal
- [ ] **SEC-05**: Database connections use SSL encryption

### Request Hardening

- [ ] **SEC-02**: Security headers applied (CSP, HSTS, X-Frame-Options, X-Content-Type-Options)
- [ ] **SEC-03**: Rate limiting enforced on login, signup, and sensitive API endpoints

### Authentication Hardening

- [ ] **SEC-04**: Password strength validation enforced (minimum length, complexity rules)
- [ ] **SEC-07**: Account lockout triggered after repeated failed login attempts

### Audit & Compliance

- [ ] **SEC-06**: Security events logged (logins, failed attempts, admin actions)

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Advanced Security

- **SEC-08**: Two-factor authentication (TOTP/WebAuthn)
- **SEC-09**: Session management UI (view/revoke active sessions)
- **SEC-10**: IP allowlisting for admin functions
- **SEC-11**: CORS configuration hardening

### Compliance

- **SEC-12**: GDPR data export/deletion
- **SEC-13**: SOC 2 audit logging enhancements

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| SSO/SAML/OIDC | Enterprise scope, defer to v0.3+ |
| WAF integration | Infrastructure-level, not application |
| Penetration testing | Separate engagement, not code deliverable |
| Hardware security modules (HSM) | Enterprise scope |
| Client-side encryption (E2EE) | Architectural change, major scope |

## Traceability

Which phases cover which requirements. Updated by create-roadmap.

| Requirement | Phase | Status |
|-------------|-------|--------|
| SEC-01 | TBD | Pending |
| SEC-02 | TBD | Pending |
| SEC-03 | TBD | Pending |
| SEC-04 | TBD | Pending |
| SEC-05 | TBD | Pending |
| SEC-06 | TBD | Pending |
| SEC-07 | TBD | Pending |

**Coverage:**
- v1 requirements: 7 total
- Mapped to phases: 0
- Unmapped: 7 (awaiting roadmap)

---
*Requirements defined: 2026-01-18*
*Last updated: 2026-01-18 after initial definition*
