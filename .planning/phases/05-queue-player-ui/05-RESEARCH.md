# Phase 5: Queue & Full Player UI - Research

**Researched:** 2026-05-26
**Domain:** Audio Playback UI, Queue Management, Gesture Interactions
**Confidence:** HIGH

## Summary

This phase focuses on the "last mile" of the playback experience: the visual and logical management of the track queue and the expanded player interface. We will implement a YouTube Music-style "mini player" that expands into a full "Now Playing" interface. On desktop, this expanded state manifests as a 380px sidebar, while on mobile, it occupies the full screen with gesture-based dismissals.

Queue logic will be enhanced with drag-and-drop capabilities using `dnd-kit`, and sophisticated insertion strategies ("Play Next", "Add to Queue"). Autoplay will be integrated using InnerTube's `getUpNext` endpoint to ensure music never stops.

**Primary recommendation:** Use `framer-motion` for all transition animations (especially the shared layout expansion) and `dnd-kit` for queue reordering to ensure a "native-feel" high-performance UI.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Queue State | Browser (Zustand) | — | Needs to be reactive and high-performance for drag/drop. |
| Playback Controls | Browser (AudioEngine) | — | Direct interaction with HTMLAudioElement. |
| Autoplay Suggestions | API (InnerTube) | Browser | Fetched from YouTube via proxy/backend. |
| Persistence | LocalStorage | — | Volume, shuffle, and repeat state should persist across sessions locally. |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `dnd-kit` | ^6.0.0 | Drag & Drop | Modern, accessible, and performant for React. [VERIFIED: npm] |
| `framer-motion` | ^11.0.0 | Animations | The industry standard for React animations and gestures. [VERIFIED: npm] |
| `zustand` | ^5.0.0 | State Management | Already in use; handles complex store logic easily. [VERIFIED: codebase] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|--------------|
| `react-window` | ^1.8.0 | Virtualization | To maintain performance with large queues (>100 items). [VERIFIED: community] |
| `lucide-react` | ^0.400.0 | Icons | High-quality icons matching YTM style. [VERIFIED: npm] |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `dnd-kit` | `react-beautiful-dnd` | `dnd-kit` is more modular and actively maintained for React 18/19. |
| `framer-motion` | CSS Transitions | Complex gestures like "swipe to dismiss" are much harder in pure CSS. |

**Installation:**
```bash
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities framer-motion lucide-react react-window
```

## Architecture Patterns

### System Architecture Diagram
1. **Input:** User interaction (tap mini-player, drag song, context menu).
2. **Processing:** 
   - UI Store toggles expansion state.
   - Playback Store updates queue array (insertion or reordering).
   - AudioEngine prepares next track if queue changed.
3. **External:** `getUpNext` called when queue is near end.
4. **Output:** 
   - Framer Motion animates UI expansion.
   - Browser Media Session updates metadata.
   - LocalStorage persists playback settings.

### Recommended Project Structure
```
frontend/
├── components/
│   ├── player/
│   │   ├── MiniPlayer.tsx       # Bottom bar
│   │   ├── FullPlayer.tsx       # Desktop Sidebar / Mobile Fullscreen
│   │   ├── PlayerControls.tsx   # Reusable play/pause/prev/next
│   │   └── ProgressBar.tsx      # High-precision seek bar
│   └── queue/
│       ├── QueueList.tsx        # Container with dnd-kit context
│       ├── QueueItem.tsx        # Draggable item
│       └── AutoplaySection.tsx  # Suggested tracks
```

### Pattern 1: Shared Layout Expansion
Use `layoutId` to animate the thumbnail from the mini-player directly into the full player's large cover art.

```typescript
// Mini Player
<motion.img layoutId="player-thumb" src={track.thumbnail} />

// Full Player
<motion.img layoutId="player-thumb" src={track.thumbnail} className="w-full h-full" />
```

### Anti-Patterns to Avoid
- **Heavily nested state for queue:** Avoid putting track objects multiple times in state. Use IDs and a normalized cache if possible, but for simplicity, a flat array in Zustand is usually fine for queues under 1000 items.
- **Immediate Autoplay Fetch:** Don't fetch `getUpNext` on every song start. Wait until the user is actually playing a track that needs a continuation.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| List Reordering | Custom drag handlers | `dnd-kit` | Edge cases in touch vs mouse, accessibility, and drop animations. |
| Gesture Physics | Custom touch listeners | `framer-motion` | Inertia, rubber-banding, and velocity-based animations are complex. |
| List Virtualization | Custom scroll listeners | `react-window` | Managing DOM nodes for large lists is error-prone. |

## Common Pitfalls

### Pitfall 1: Shuffle State Desync
**What goes wrong:** User toggles shuffle, then "unshuffles" but the queue doesn't return to the original order or jumps to a random song.
**Prevention strategy:** Keep `originalQueue` as a separate array or store `shuffledIndices`.
**Warning signs:** Current song changes when toggling shuffle.

### Pitfall 2: Memory Leaks with Large Queues
**What goes wrong:** The UI becomes unresponsive after playing a few "Radios" that accumulate thousands of tracks.
**How to avoid:** Cap the queue at a reasonable number (e.g., 500) or use virtualization.

## Code Examples

### Shuffle Algorithm (Fisher-Yates)
```typescript
function shuffle(array: any[]) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[shuffled[j]]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}
```

### Mobile Swipe-to-Dismiss
```typescript
<motion.div
  drag="y"
  dragConstraints={{ top: 0 }}
  onDragEnd={(e, info) => {
    if (info.offset.y > 200) minimizePlayer();
  }}
  style={{ y }}
>
  {/* Full Player Content */}
</motion.div>
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `react-beautiful-dnd` | `dnd-kit` | 2021+ | Better performance, modularity, and accessibility. |
| Prop drilling state | Zustand / Signals | 2022+ | Simpler code, easier testing, and better performance. |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `dnd-kit` works seamlessly with React 19. | Standard Stack | High - Need to check if any peer dep issues. |
| A2 | YouTube Music Desktop sidebar is 380px. | Summary | Low - UI might look slightly off if it's 400px. |

## Open Questions

1. **Autoplay Persistence**
   - What we know: YTM adds a "header" before autoplay songs.
   - What's unclear: Should autoplay tracks be saved to the database if the user saves the session?
   - Recommendation: Only persist user-added tracks; treat autoplay as transient.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Browser | Playback | ✓ | — | — |
| InnerTube | Suggestions | ✓ | — | — |

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest + React Testing Library |
| Quick run command | `npm test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command |
|--------|----------|-----------|-------------------|
| PLAYER-01 | Reorder queue via drag | Integration | `npm test tests/queue.test.ts` |
| PLAYER-02 | Mini-player progress bar matches time | Unit | `npm test tests/mini-player.test.ts` |
| PLAYER-03 | Expand animation triggers | Integration | `npm test tests/animation.test.ts` |

## Security Domain

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V5 Input Validation | yes | Validate `videoId` formats in all playback actions. |

## Gray Area Decisions (GADs)

### GAD-01: Shuffle Persistence
**Approach:** Store `shuffledIndices` (array of original indices).
**Rationale:** Allows toggling shuffle on/off without mutating the actual data source, making "unshuffle" trivial and preventing accidental data loss.

### GAD-02: Autoplay Triggering
**Approach:** Fetch `getUpNext` when the player enters the *last* track of the current user-defined queue.
**Rationale:** Reduces unnecessary API calls while ensuring a seamless transition. If the user skips to the end, fetch immediately.

### GAD-03: Expansion Animation Performance
**Approach:** Use `layoutId` but disable heavy background blurs/filters *during* the transition if device performance is low (detected via `device-memory` or similar).

## Sources

### Primary (HIGH confidence)
- `dnd-kit` official docs (Sortable)
- `framer-motion` official docs (Layout animations)
- `youtubei.js` docs (`getUpNext`)

### Secondary (MEDIUM confidence)
- YouTube Music Web UI reverse-engineering (sidebar width, progress bar height).
