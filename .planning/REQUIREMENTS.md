# Requirements: OComms v0.2.0 Security Hardening

**Defined:** 2026-01-18
**Core Value:** Data sovereignty — complete control over communication data

## v1 Requirements

Requirements for v0.2.0 milestone. Each maps to roadmap phases.

### Authorization (from CODE_REVIEW.MD - HIGH priority)

- [x] **AUTHZ-01**: Socket.IO room join validates channel/DM membership before subscribing
- [x] **AUTHZ-02**: Socket.IO workspace join validates organization membership
- [x] **AUTHZ-03**: Thread events validate channel/DM membership before read/write
- [x] **AUTHZ-04**: Reaction events validate channel/DM membership before add/remove/list
- [x] **AUTHZ-05**: Unread events validate channel/DM membership before operations
- [x] **AUTHZ-06**: Channel server actions validate organization membership
- [x] **AUTHZ-07**: Conversation server actions validate organization membership

### Data Integrity (from CODE_REVIEW.MD - MEDIUM priority)

- [x] **INTG-01**: Message sequencing uses atomic operations to prevent duplicates
- [x] **INTG-02**: Schema foreign keys handle user deletion without constraint violations
- [x] **INTG-03**: Export endpoint scoped to requesting user's organization only

### Input Validation (from CODE_REVIEW.MD - LOW priority)

- [x] **VAL-01**: Avatar upload validates file signature server-side (not just MIME type)
- [x] **VAL-02**: Middleware validates session validity, not just cookie presence

### Transport Security

- [x] **SEC-01**: Application serves all traffic over HTTPS with Let's Encrypt auto-renewal
- [x] **SEC-05**: Database connections use SSL encryption

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
| AUTHZ-01 | Phase 9 | Complete |
| AUTHZ-02 | Phase 9 | Complete |
| AUTHZ-03 | Phase 9 | Complete |
| AUTHZ-04 | Phase 9 | Complete |
| AUTHZ-05 | Phase 9 | Complete |
| AUTHZ-06 | Phase 9 | Complete |
| AUTHZ-07 | Phase 9 | Complete |
| INTG-01 | Phase 9 | Complete |
| INTG-02 | Phase 9 | Complete |
| INTG-03 | Phase 9 | Complete |
| VAL-01 | Phase 9 | Complete |
| VAL-02 | Phase 9 | Complete |
| SEC-01 | Phase 10 | Complete |
| SEC-05 | Phase 10 | Complete |
| SEC-02 | Phase 11 | Pending |
| SEC-03 | Phase 11 | Pending |
| SEC-04 | Phase 12 | Pending |
| SEC-07 | Phase 12 | Pending |
| SEC-06 | Phase 13 | Pending |

**Coverage:**
- v1 requirements: 19 total
- Mapped to phases: 19
- Unmapped: 0 ✓

---
*Requirements defined: 2026-01-18*
*Last updated: 2026-01-18 after CODE_REVIEW.MD integration*
