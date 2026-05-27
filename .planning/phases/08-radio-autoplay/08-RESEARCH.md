# Phase 8: Radio & Autoplay - Research

**Researched:** 2026-05-25
**Domain:** Audio Engine, Queue Management, YouTube Music API
**Confidence:** HIGH

## Summary

This phase implements the "Radio" (Mix) feature for ZHA, allowing users to initiate a continuous stream of music based on a seed song or artist. It involves integrating `yt.music.getWatchPlaylist` to fetch seed-based music queues and implementing a robust queue management system to distinguish between "Manual" (user-added) and "Radio" (system-generated) tracks.

**Primary recommendation:** Use `yt.music.getWatchPlaylist(videoId)` to seed the Radio queue and treat it as a secondary, reactive queue segment. Implement a "Divider" component to visually separate manual user items from dynamically appended radio tracks.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Radio Generation | API / Backend | Frontend | Backend should proxy InnerTube calls to maintain secret rotation and session hygiene. |
| Queue State | Frontend | Backend | The browser (Frontend) must manage the visual queue divider and local radio buffer. |
| Batch Loading | Frontend | — | Frontend triggers the "next batch" fetch when the local radio buffer hits the threshold. |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `youtubei.js` | 17.0.1 | InnerTube API client | Industry standard for unofficial YT/YT Music interaction. |

## Architecture Patterns

### Pattern: The "Autoplay" Queue Divider
Maintain the queue as a flat list of `Track` objects. Insert a virtual `Divider` object at the boundary where the user-added queue ends and the Radio (Autoplay) queue begins. 

- **Manual Tracks:** User-initiated, immutable until reordered.
- **Radio Tracks:** Append-only, dynamic, reactive to current playback.

### Pattern: Reactive Radio Buffer
1. **Trigger:** When playback enters the last 5 tracks of the radio segment.
2. **Action:** Call `yt.music.getWatchPlaylist` using the last known Radio track as a seed.
3. **De-duplication:** Frontend must filter incoming batch tracks against the existing `Track` IDs in the `Manual` and `Radio` queue segments to prevent repetition.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| InnerTube Session | Custom session logic | `youtubei.js` | Session state, PO tokens, and client context are complex to maintain manually. |

## Common Pitfalls

### Pitfall 1: Radio/Autoplay Duality
**What goes wrong:** User shuffle and radio generation clash, resulting in non-sequential autoplay.
**Prevention:** Keep the "Radio" queue segment separate from the "Manual" queue. Disable shuffle for the Radio segment by default, or implement a "Shuffled Radio" view by re-mapping the entire local buffer.

### Pitfall 2: Stale Radio Seeds
**What goes wrong:** Radio breaks if the seed track is unavailable/deleted.
**Prevention:** Gracefully handle API errors. If a radio fetch fails, notify the user or attempt to re-seed from the current track's album/artist ID.

## State of the Art

| Old Approach | Current Approach |
|--------------|------------------|
| Infinite scroll of related tracks | State-managed local queue buffer (e.g., 20 tracks) |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `yt.music.getWatchPlaylist` returns a list that can be sequentially buffered | Queue Divider | Minor (requires restructuring queue storage logic) |

## Open Questions

1. **Seed Reliability:** How should the UI respond if an artist radio seed track is deleted? 
   - *Suggestion:* Auto-advance to next in current queue or trigger a re-seed from the artist's top tracks.
2. **Shuffle Interaction:** Should enabling shuffle force the Radio segment to re-shuffle existing buffered tracks, or just re-shuffle future incoming batches?
   - *Recommendation:* Re-shuffle existing buffer for immediate feedback.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `youtubei.js` | Radio Generation | ✓ | 17.0.1 | — |

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest / Vitest |
| Full suite command | `npm test` |

### Wave 0 Gaps
- [ ] Mock `getWatchPlaylist` to simulate radio batch responses.
- [ ] Unit test: Verify queue divider logic prevents radio tracks from being inserted into the "Manual" segment.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V5 Input Validation | yes | Validate `videoId` patterns before passing to InnerTube. |

### Known Threat Patterns for `youtubei.js`

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Client Identity Spoofing | Information Disclosure | Rotate PO tokens via the existing session manager. |

## Sources

### Primary (HIGH confidence)
- [ytjs.dev documentation](https://ytjs.dev/) - `getWatchPlaylist` usage.
- `frontend/lib/innertube/session.ts` - Verified existing session management.
