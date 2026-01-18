# Roadmap: OComms

## Milestones

- ✅ **v0.1.0 Full Conversation** - Phases 1-8 (shipped 2026-01-18)
- 🚧 **v0.2.0 Security Hardening** - Phases 9-12 (in progress)

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

<details>
<summary>✅ v0.1.0 Full Conversation (Phases 1-8) - SHIPPED 2026-01-18</summary>

Real-time messaging, channels, DMs, threading, mentions, search, presence, reactions, and Docker deployment.

51 requirements delivered across 8 phases.

</details>

### 🚧 v0.2.0 Security Hardening (In Progress)

**Milestone Goal:** Production-ready security baseline with encrypted transport, hardened authentication, and audit trail.

- [ ] **Phase 9: Transport Security** - Encrypted traffic and database connections
- [ ] **Phase 10: Request Hardening** - Security headers and rate limiting
- [ ] **Phase 11: Authentication Hardening** - Password strength and account lockout
- [ ] **Phase 12: Audit Logging** - Security event logging

## Phase Details

### Phase 9: Transport Security
**Goal**: All traffic encrypted in transit
**Depends on**: Nothing (first phase of milestone)
**Requirements**: SEC-01, SEC-05
**Success Criteria** (what must be TRUE):
  1. All HTTP requests redirect to HTTPS
  2. SSL certificate auto-renews before expiry
  3. Database connections use SSL encryption
**Research**: Likely (Let's Encrypt + Docker integration)
**Research topics**: Let's Encrypt automation with Docker, nginx/Caddy reverse proxy, PostgreSQL SSL configuration
**Plans**: TBD

Plans:
- [ ] 09-01: TBD

### Phase 10: Request Hardening
**Goal**: Requests protected against common attacks
**Depends on**: Phase 9 (HTTPS must be working)
**Requirements**: SEC-02, SEC-03
**Success Criteria** (what must be TRUE):
  1. Security headers present on all responses (CSP, HSTS, X-Frame-Options, X-Content-Type-Options)
  2. Rate limiting blocks excessive requests (429 response)
  3. Login/signup endpoints have stricter rate limits
**Research**: Unlikely (standard patterns)
**Plans**: TBD

Plans:
- [ ] 10-01: TBD

### Phase 11: Authentication Hardening
**Goal**: Authentication resistant to attack
**Depends on**: Phase 10 (rate limiting protects auth endpoints)
**Requirements**: SEC-04, SEC-07
**Success Criteria** (what must be TRUE):
  1. Weak passwords rejected at signup and password change
  2. Account locks after repeated failed login attempts
  3. Locked users see clear message with unlock path
**Research**: Unlikely (better-auth has built-in features)
**Plans**: TBD

Plans:
- [ ] 11-01: TBD

### Phase 12: Audit Logging
**Goal**: Security events visible for investigation
**Depends on**: Phase 11 (auth events to log)
**Requirements**: SEC-06
**Success Criteria** (what must be TRUE):
  1. Login attempts (success/fail) logged with timestamp, IP, user
  2. Admin actions logged
  3. Logs can be queried for security investigation
**Research**: Unlikely (standard logging patterns)
**Plans**: TBD

Plans:
- [ ] 12-01: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 9 → 10 → 11 → 12

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1-8 | v0.1.0 | - | Complete | 2026-01-18 |
| 9. Transport Security | v0.2.0 | 0/? | Not started | - |
| 10. Request Hardening | v0.2.0 | 0/? | Not started | - |
| 11. Authentication Hardening | v0.2.0 | 0/? | Not started | - |
| 12. Audit Logging | v0.2.0 | 0/? | Not started | - |
