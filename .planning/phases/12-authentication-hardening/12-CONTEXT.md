# Phase 12: Authentication Hardening - Context

**Gathered:** 2026-01-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Make authentication resistant to attack through password strength validation and account lockout mechanisms. Users must meet password requirements at signup and password change. Repeated failed login attempts trigger progressive delays and eventual account lockout.

</domain>

<decisions>
## Implementation Decisions

### Password strength rules
- Minimum 8 characters
- Require mixed case + number + symbol
- No dictionary/common password check
- Validate on signup and password change (existing users keep current passwords)

### Lockout behavior
- 5 failed attempts before lockout
- Account-based lockout (not IP-based)
- Failed attempt count resets on successful login
- Progressive delays before lockout (1s, 2s, 5s... increasing wait times between retries)

### User messaging
- Specific feedback on password rejection ("needs uppercase letter and symbol")
- Real-time password strength indicator as user types (weak/medium/strong + requirements checklist)
- Vague lockout message ("Unable to log in") — doesn't confirm account exists
- Email notification with unlock link sent to locked users

### Unlock mechanism
- 15-minute base lockout duration
- Progressive lockout escalation (1st: 15 min, 2nd: 30 min, 3rd: 1 hour)
- Password reset bypasses lockout immediately
- Admins can manually unlock accounts

### Claude's Discretion
- Exact delay progression timing
- Password strength meter visual design
- Email template wording
- Admin unlock UI placement

</decisions>

<specifics>
## Specific Ideas

- Login page shows vague errors to prevent account enumeration, but email notification gives legitimate users a clear path forward
- Progressive delays should slow down automated attacks before the hard lockout kicks in

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 12-authentication-hardening*
*Context gathered: 2026-01-18*
