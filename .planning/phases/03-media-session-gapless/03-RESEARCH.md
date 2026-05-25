# Phase 3: Media Session + Gapless - Research

**Researched:** 2026-05-26
**Domain:** Audio Playback, Web APIs (MediaSession), Buffer Management
**Confidence:** HIGH

## Summary

This phase focuses on integrating the web application with the operating system's media controls (Media Session API) and implementing a seamless "gapless" transition between tracks. Research confirms that while standard `HTMLAudioElement` behavior often introduces a "blip" or gap due to network and decoder latency, a "Double Buffering" strategy using two alternating audio elements combined with a high-precision look-ahead timer can achieve high-quality gapless playback.

**Primary recommendation:** Implement a Double Buffering `AudioEngine` that pre-loads the next track into a hidden element 10 seconds before the current track ends, and uses `requestAnimationFrame` to trigger the switch ~200ms before the current track finishes to mask startup latency.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Audio Playback | Browser (Client) | — | Managed by `HTMLAudioElement` instances in the browser memory. |
| Media Session Controls | Browser (Client) | OS | Browser provides the API; OS handles UI and hardware key routing. |
| Metadata Management | Browser (Client) | API | Client fetches track metadata from API and pushes to `navigator.mediaSession`. |
| Gapless Logic | Browser (Client) | — | Timing and element switching are entirely client-side logic. |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Media Session API | Built-in | OS-level media controls | W3C Standard, high support in modern browsers. [VERIFIED: MDN] |
| HTMLAudioElement | Built-in | Primary audio playback | Project constraint; robust and handles most codecs. [VERIFIED: PROJECT.md] |
| requestAnimationFrame | Built-in | High-precision timing | Superior to `timeupdate` for millisecond-level precision. [VERIFIED: Chrome DevDocs] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|--------------|
| Vitest | ^3.0.0 | Unit/Integration testing | Recommended for Phase 3 Wave 0 to test AudioEngine logic. [ASSUMED] |
| youtubei.js | ^17.0.1 | Thumbnail resolution | Fetches high-res artwork for MediaSession. [CITED: package.json] |

**Installation:**
```bash
npm install -D vitest @testing-library/react
```

## Architecture Patterns

### Recommended Project Structure
```
frontend/
├── lib/
│   ├── audio/
│   │   ├── AudioEngine.ts     # Refactor to handle dual elements & MediaSession
│   │   └── MediaSession.ts    # Helper for OS-level integration
└── stores/
    └── playbackStore.ts       # Track status (duration, current/next)
```

### Pattern 1: Double Buffering (Ping-Pong)
**What:** Maintain two `HTMLAudioElement` instances (`playerA` and `playerB`). One is active; the other is used for pre-loading the next track.
**When to use:** All playlist transitions.
**Example:**
```typescript
// Simplified logic for AudioEngine
class AudioEngine {
  private players = [new Audio(), new Audio()];
  private activeIdx = 0;

  private prepareNext(nextUrl: string) {
    const next = this.players[1 - this.activeIdx];
    next.src = nextUrl;
    next.preload = "auto";
    next.load(); // Prime the buffer
  }

  private switch() {
    const prev = this.players[this.activeIdx];
    const next = this.players[1 - this.activeIdx];
    next.play();
    prev.pause();
    prev.src = ""; // Clean up
    this.activeIdx = 1 - this.activeIdx;
    this.updateMediaSession();
  }
}
```

### Anti-Patterns to Avoid
- **Single Element `src` Swap:** Changing `src` on a single element always causes a gap as the browser must re-initialize the decoder and negotiate a new network connection.
- **Relying on `timeupdate`:** The `timeupdate` event fires only 4-250ms apart. For gapless, this is too coarse. Use `requestAnimationFrame` for ~16ms resolution.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Decoding/Demuxing | Manual parsing | `HTMLAudioElement` | Extremely complex to handle multi-codec support manually. |
| Media Hub UI | Custom floating window | Media Session API | Native OS UI handles volume, lock screen, and hardware keys automatically. |

## Common Pitfalls

### Pitfall 1: iOS Safari "Suspended" Session
**What goes wrong:** Audio stops playing when the tab is backgrounded or the screen locks.
**Why it happens:** iOS requires active audio to keep the session alive. If there is a gap between two elements, iOS may kill the session.
**How to avoid:** Ensure the second element starts *before* or *at the exact moment* the first ends. A 50ms overlap is safer than a 50ms gap.

### Pitfall 2: Media Session Metadata Desync
**What goes wrong:** The lock screen shows "Track 1" while "Track 2" is playing.
**Why it happens:** Metadata update triggered too late or failed.
**How to avoid:** Update `navigator.mediaSession.metadata` immediately in the `switch()` logic.

## Code Examples

### Media Session Integration
```typescript
// Source: https://developer.mozilla.org/en-US/docs/Web/API/Media_Session_API
if ('mediaSession' in navigator) {
  navigator.mediaSession.metadata = new MediaMetadata({
    title: track.title,
    artist: track.artist,
    album: track.album || 'ZHA',
    artwork: [
      { src: track.cover, sizes: '512x512', type: 'image/jpeg' }
    ]
  });

  navigator.mediaSession.setActionHandler('play', () => audioEngine.play());
  navigator.mediaSession.setActionHandler('pause', () => audioEngine.pause());
  navigator.mediaSession.setActionHandler('nexttrack', () => audioEngine.next());
  navigator.mediaSession.setActionHandler('previoustrack', () => audioEngine.previous());
  navigator.mediaSession.setActionHandler('seekto', (details) => {
    if (details.seekTime) audioEngine.seek(details.seekTime);
  });
}
```

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | iOS allows two Audio tags to play simultaneously | Pattern 1 | If wrong, gapless must use a single element + Blob/MSE, which is harder. |
| A2 | MediaSession remains active during element swap | Pitfall 1 | If session "blips", the lock screen UI will flicker. |

## Open Questions

1. **How does YouTube handle 403s during pre-load?**
   - Recommendation: If the pre-load fails (e.g., URL expired), re-fetch the stream URL immediately upon the gapless trigger.
2. **Bandwidth consumption of pre-loading?**
   - Recommendation: Only start pre-loading 10s before the end. If the user skips, we wasted 10s of buffer, which is acceptable.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Media Session API | OS Controls | ✓ | Browser Native | No OS controls |
| HTMLAudioElement | Playback | ✓ | Browser Native | — |

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest |
| Config file | `vitest.config.ts` |
| Quick run command | `npm run test` |

### Wave 0 Gaps
- [ ] Install Vitest and JSDOM.
- [ ] Create `frontend/lib/audio/__tests__/AudioEngine.test.ts`.
- [ ] Mock `Audio` and `navigator.mediaSession`.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V5 Input Validation | yes | Validate `videoId` format before fetching streams. |
| V6 Cryptography | yes | Ensure stream URLs are handled as temporary tokens (no long-term storage). |

## Sources

### Primary (HIGH confidence)
- MDN - Media Session API - Features and metadata support.
- W3C HTML Media - `HTMLMediaElement` state transitions.

### Secondary (MEDIUM confidence)
- Chrome Developers - "High-quality media playback" guide.
- StackOverflow - Community patterns for gapless audio with double buffering.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Built-in browser APIs.
- Architecture: MEDIUM - Requires careful implementation for iOS stability.
- Pitfalls: HIGH - Well-documented browser quirks.

**Research date:** 2026-05-26
**Valid until:** 2026-06-26
