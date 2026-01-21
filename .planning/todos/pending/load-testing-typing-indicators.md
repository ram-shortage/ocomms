# Load Testing: Typing Indicators at Scale

**Created:** 2026-01-21
**Priority:** Low
**Category:** Performance

## Summary

Phase 29 descoped TEST-08 (performance testing for 500+ concurrent users) due to infrastructure requirements. This todo tracks the deferred work.

## Requirements

From REQUIREMENTS.md:
- TEST-08: Performance testing for typing indicators at scale

## Acceptance Criteria

1. Typing indicators work correctly at 500+ concurrent users
2. No broadcast storms under load
3. Server memory and CPU remain stable
4. Sub-100ms latency for typing events

## Technical Approach

- Use k6 or Artillery for WebSocket load testing
- Simulate 500+ users typing simultaneously in a channel
- Monitor Redis pub/sub backpressure
- Monitor Socket.IO adapter performance

## Infrastructure Needed

- Load testing tool (k6 recommended)
- Staging environment with production-like specs
- Monitoring dashboard for Socket.IO metrics

---

*Created during Phase 29 stabilization*
