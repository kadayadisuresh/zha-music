# Phase 11: Collaborative Playlists - Research

**Researched:** 2025-05-22
**Domain:** Collaborative Playlists, WebSockets, Real-time Sync
**Confidence:** HIGH

## Summary

This phase introduces collaborative playlist functionality, enabling multiple users to manage the same playlist in real-time. This requires database schema updates, WebSocket integration for live updates, and conflict resolution strategy for concurrency.

**Primary recommendation:** Use a Room-based connection manager for simple setups or a Pub/Sub pattern (via `broadcaster` or Redis) if horizontal scalability is anticipated. Implement "Last Write Wins" with a `version` or `updated_at` timestamp on playlist items.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Data Modeling | API / Backend | — | Schema must support collaboration flags and versioning |
| Real-time Sync | API / Backend | Browser | WebSocket handlers reside in the backend to manage state/broadcast |
| Conflict Res | API / Backend | — | Business logic ensures data integrity during updates |
| Invite System | API / Backend | — | Secure token generation and validation |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `fastapi` | (existing) | API Framework | Async support for WebSockets |
| `sqlalchemy` | (existing) | ORM | Database interaction |
| `broadcaster` | (latest) | Pub/Sub | Simplifies cross-instance messaging |

## Architecture Patterns

### Pattern 1: WebSocket Broadcast
**What:** Use a Connection Manager to track users in a playlist "room". When one user modifies the list (add/remove/reorder), broadcast the change to all subscribers.
**When to use:** Managing real-time state sync.

### Pattern 2: Last Write Wins (LWW)
**What:** Add a `version` or `updated_at` column to `playlist_songs`.
**When to use:** Handling concurrent modifications from multiple users.
**Implementation:** When updating a song position, check the incoming version against the DB. If it matches, perform the update and increment version; otherwise, reject or reconcile.

## Database Schema Updates (Required)

### `Playlist` model
- `is_collaborative` (Boolean, default=False)
- `invite_token` (String, unique, index)

### `PlaylistSong` model
- `version` (Integer, default=1) — *For LWW concurrency*

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| WebSocket Mgmt | Custom dict-based tracking | `broadcaster` library | Handles pub/sub complexity and scaling better |
| Token Gen | `random.random()` | `secrets.token_urlsafe(24)` | Cryptographically secure tokens |

## Common Pitfalls

- **State Inconsistency:** Broadcasting only the delta might leave a late-joiner out of sync. Always provide an endpoint to fetch the current full state upon joining.
- **WebSocket Flooding:** Debounce client-side events like reordering before sending updates.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Redis | Pub/Sub Sync | ✗ | — | In-memory `broadcaster` (Memory) |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `broadcaster` is preferred for FastAPI/WebSocket | Stack | Minimal, can fall back to manual dict management |

## Open Questions

1. **How to handle large playlist reorders?**
   - Recommendation: Broadcast the final order after reorder completion rather than every drag-and-drop intermediate step.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V4 Access Control | yes | Validate user permission (is owner or collaborator) before WebSocket action |
| V5 Input Validation | yes | Validate all WebSocket payload JSON |

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH
- Architecture: HIGH
- Pitfalls: HIGH

**Research date:** 2025-05-22
**Valid until:** 2025-06-22
