# Phase 12: Jam - Research

**Researched:** 2026-05-26
**Domain:** Real-time Jam Sessions (WebSocket orchestration)
**Confidence:** HIGH

## Summary

The Jam feature requires implementing real-time WebSocket synchronization for up to 10 users per session. The core challenge is maintaining synchronized playback state across multiple clients with varying network conditions. The solution centers on a host/guest model where the host is the source of truth for playback position, while guests subscribe to real-time events to stay in sync.

**Primary recommendation:** Use FastAPI's `websockets` support for real-time communication and a centralized `JamManager` singleton in the backend to manage session state, participant lists, and event routing.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Jam Session Management | Backend | — | Centralized session state (join codes, participant lists). |
| WebSocket Orchestration | Backend | Frontend | Bidirectional event propagation. |
| Clock Synchronization | Frontend | Backend | Client-side drift measurement and state correction. |
| Host Control Enforcement | Backend | — | Validation of sender against current session host. |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `fastapi` | 0.110+ | API/WebSocket server | Robust support for async WebSocket connections. |
| `pydantic` | 2.x | Event serialization | Strong typing for WebSocket event payloads. |
| `Socket.io` (conceptual) | N/A | Protocol | Standardizing on JSON-based event payloads. |

## Architecture Patterns

### System Architecture Diagram

```
[Host Client]  <==> [Backend WebSocket Manager] <==> [Guest Client]
      |                   | (State Store)                |
      |                   | (Event Router)               |
      +-------[Events]----+------------------------------+
```

### Pattern 1: Event-Based Sync
**What:** The server routes events between participants.
**When to use:** All jam-related actions: `play`, `pause`, `seek`, `track_change`, `participant_joined`, `participant_left`, `permission_changed`.

### Anti-Patterns to Avoid
- **Client-side polling:** Do not poll the server for state; rely entirely on push-based WebSocket updates.
- **Trusting the guest:** Never allow a guest client to update the master state without host validation in the backend.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| WebSocket Auth | Custom tokens | JWT cookies (existing) | Reuse existing security infra. |
| Clock Sync | Pure NTP client | Network latency/server-timestamp delta | Simple application-layer logic is sufficient. |

## Runtime State Inventory

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None | N/A |
| Live service config | None | N/A |
| OS-registered state | None | N/A |
| Secrets/env vars | None | N/A |
| Build artifacts | None | N/A |

## Common Pitfalls

### Pitfall 1: Clock Drift
**What goes wrong:** Guests get out of sync with the host's playback position.
**Why it happens:** Differences in local clock and network latency.
**How to avoid:** Periodically sync the timestamp delta between client and server; adjust seeking based on the drift.

## Code Examples

### WebSocket Sync (Conceptual)
```typescript
// Backend/Frontend event pattern
interface JamEvent {
  type: 'PLAY' | 'PAUSE' | 'SEEK' | 'TRACK_CHANGE';
  payload: any;
  sender_id: string;
  timestamp: number; // Server-relative time
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Polling | WebSockets | Standardized | Near-real-time sync. |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Clock drift can be solved via server-side timestamps. | Pitfall 1 | MEDIUM |

## Open Questions

1. **Clock drift tolerance:** Recommended threshold for auto-resync is ~500ms to avoid jarring jumps.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Python/FastAPI | Backend | ✓ | 3.10+/0.110 | — |
| Browser WebSocket API| Frontend | ✓ | Native | — |

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | JWT validation on connection |
| V4 Access Control | yes | Validate host ID per session |
| V5 Input Validation | yes | Pydantic model validation |

## Sources

### Primary (HIGH confidence)
- FastAPI docs (WebSockets)
- Project codebase (auth/security patterns)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH
- Architecture: HIGH
- Pitfalls: MEDIUM

**Research date:** 2026-05-26
**Valid until:** 2026-06-25
