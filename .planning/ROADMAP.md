# Roadmap: OComms

## Milestones

- **v0.1.0 Full Conversation** - Phases 1-8 (shipped 2026-01-18)
- **v0.2.0 Security Hardening** - Phases 9-13 (in progress)

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

<details>
<summary>v0.1.0 Full Conversation (Phases 1-8) - SHIPPED 2026-01-18</summary>

Real-time messaging, channels, DMs, threading, mentions, search, presence, reactions, and Docker deployment.

51 requirements delivered across 8 phases.

</details>

### v0.2.0 Security Hardening (In Progress)

**Milestone Goal:** Production-ready security baseline with authorization fixes, encrypted transport, hardened authentication, and audit trail.

- [x] **Phase 9: Authorization & Data Integrity Fixes** - Critical fixes from CODE_REVIEW.MD
- [x] **Phase 10: Transport Security** - Encrypted traffic and database connections
- [x] **Phase 11: Request Hardening** - Security headers and rate limiting
- [x] **Phase 12: Authentication Hardening** - Password strength and account lockout
- [ ] **Phase 13: Audit Logging** - Security event logging

## Phase Details

### Phase 9: Authorization & Data Integrity Fixes
**Goal**: Fix authorization bypass vulnerabilities and data integrity issues from code review
**Depends on**: Nothing (critical fixes, first priority)
**Requirements**: AUTHZ-01, AUTHZ-02, AUTHZ-03, AUTHZ-04, AUTHZ-05, AUTHZ-06, AUTHZ-07, INTG-01, INTG-02, INTG-03, VAL-01, VAL-02
**Success Criteria** (what must be TRUE):
  1. Socket.IO room/workspace joins validate membership (cannot subscribe to unauthorized channels)
  2. Thread, reaction, and unread events reject requests for channels user doesn't belong to
  3. Channel and conversation actions reject cross-organization requests
  4. Message sequences are unique per channel (no race condition duplicates)
  5. User deletion doesn't violate foreign key constraints
**Research**: Unlikely (fixing existing code with known patterns)
**Plans**: 11 plans in 5 waves

Plans:
- [x] 09-01: Create authorization helpers module
- [x] 09-02: Add authorization to room:join and workspace:join
- [x] 09-03: Add authorization to thread handlers
- [x] 09-04: Add authorization to reaction handlers
- [x] 09-05: Add authorization to unread handlers
- [x] 09-06: Add organization validation to server actions
- [x] 09-07: Add unique sequence constraints to messages
- [x] 09-08: Fix created_by foreign key constraints
- [x] 09-09: Fix export endpoint org scoping
- [x] 09-10: Add avatar file signature validation
- [x] 09-11: Add middleware session validation

### Phase 10: Transport Security
**Goal**: All traffic encrypted in transit
**Depends on**: Phase 9 (authorization fixes first)
**Requirements**: SEC-01, SEC-05
**Success Criteria** (what must be TRUE):
  1. All HTTP requests redirect to HTTPS
  2. SSL certificate auto-renews before expiry
  3. Database connections use SSL encryption
**Research**: Complete (10-RESEARCH.md)
**Plans**: 3 plans in 2 waves

Plans:
- [x] 10-01: Database SSL setup (cert generation, db connection, health endpoint)
- [x] 10-02: HTTPS infrastructure (docker-compose, nginx, env config)
- [x] 10-03: Transport security verification (checkpoint)

### Phase 11: Request Hardening
**Goal**: Requests protected against common attacks
**Depends on**: Phase 10 (HTTPS must be working)
**Requirements**: SEC-02, SEC-03
**Success Criteria** (what must be TRUE):
  1. Security headers present on all responses (CSP, HSTS, X-Frame-Options, X-Content-Type-Options)
  2. Rate limiting blocks excessive requests (429 response)
  3. Login/signup endpoints have stricter rate limits
**Research**: Unlikely (standard patterns)
**Plans**: 2 plans in 2 waves

Plans:
- [x] 11-01: Security headers and rate limiting configuration
- [x] 11-02: Verify request hardening (checkpoint)

### Phase 12: Authentication Hardening
**Goal**: Authentication resistant to attack
**Depends on**: Phase 11 (rate limiting protects auth endpoints)
**Requirements**: SEC-04, SEC-07
**Success Criteria** (what must be TRUE):
  1. Weak passwords rejected at signup and password change
  2. Account locks after repeated failed login attempts
  3. Locked users see clear message with unlock path
**Research**: Complete (12-RESEARCH.md)
**Plans**: 4 plans in 3 waves

Plans:
- [x] 12-01: Lockout schema and auth hooks (password validation, failure tracking, progressive delays)
- [x] 12-02: Password strength UI (zxcvbn meter, requirements checklist)
- [x] 12-03: Unlock flow (email notification, forgot-password page, admin unlock)
- [x] 12-04: Verify authentication hardening (checkpoint)

### Phase 13: Audit Logging
**Goal**: Security events visible for investigation
**Depends on**: Phase 12 (auth events to log)
**Requirements**: SEC-06
**Success Criteria** (what must be TRUE):
  1. Login attempts (success/fail) logged with timestamp, IP, user
  2. Admin actions logged
  3. Logs can be queried for security investigation
**Research**: Unlikely (standard logging patterns)
**Plans**: 4 plans in 3 waves

Plans:
- [ ] 13-01: Audit logger module and auth event logging
- [ ] 13-02: Admin actions and authorization failure logging
- [ ] 13-03: Query API and cleanup utility
- [ ] 13-04: Verify audit logging (checkpoint)

## Progress

**Execution Order:**
Phases execute in numeric order: 9 -> 10 -> 11 -> 12 -> 13

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1-8 | v0.1.0 | - | Complete | 2026-01-18 |
| 9. Authorization & Data Integrity | v0.2.0 | 11/11 | Complete | 2026-01-18 |
| 10. Transport Security | v0.2.0 | 3/3 | Complete | 2026-01-18 |
| 11. Request Hardening | v0.2.0 | 2/2 | Complete | 2026-01-18 |
| 12. Authentication Hardening | v0.2.0 | 4/4 | Complete | 2026-01-18 |
| 13. Audit Logging | v0.2.0 | 0/4 | Ready | - |
