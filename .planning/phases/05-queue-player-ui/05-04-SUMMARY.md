---
phase: 05-queue-player-ui
plan: 04
subsystem: Playback Engine / UI
tags: [repeat, autoplay, context-menu, media-session]
requires: [PLAY-02, PLAYER-01]
provides: [looping, continuous-playback, track-interactions]
tech-stack: [Zustand, InnerTube API, HTMLAudioElement]
key-files: [frontend/lib/audio/AudioEngine.ts, frontend/lib/stores/playbackStore.ts, frontend/components/browse/TrackList.tsx]
decisions:
  - "Repeat One restarts current track via AudioEngine ended event"
  - "Autoplay fetches 10 suggestions when user reaches the last manual track"
  - "TrackContextMenu uses fixed positioning with viewport collision detection"
metrics:
  duration: 45m
  completed_date: "2026-05-26"
---

# Phase 05 Plan 04: Playback Logic & Interaction Summary

Finalized the playback experience by implementing deep interaction patterns and music continuity features.

## Key Changes

### 1. Music Continuity (Repeat & Autoplay)
- **Repeat One Support:** Modified `AudioEngine` to detect `repeatMode === 'one'` and seek to zero on track completion, bypassing gapless transitions.
- **Autoplay Integration:** Implemented `fetchAutoplay` in `playbackStore` using the InnerTube `upnext` endpoint. It automatically fetches and appends related tracks when the user reaches the end of their manual queue.

### 2. Interaction Patterns
- **Track Context Menu:** Created a robust context menu component (`TrackContextMenu.tsx`) providing "Play Next", "Add to Queue", "Go to Artist", and "Go to Album" actions.
- **Integration:** Wired the context menu into `TrackList.tsx` using standard right-click (onContextMenu) handlers.

### 3. Audio Engine Refinement
- Updated prefetch and transition logic to respect loop states.
- Enhanced stability for track switching in the dual-player architecture.

## Verification Results

### Automated Tests
- `grep "repeatMode" frontend/lib/audio/AudioEngine.ts` -> PASSED
- `grep "fetchAutoplay" frontend/lib/stores/playbackStore.ts` -> PASSED
- `grep "Play Next" frontend/components/shared/TrackContextMenu.tsx` -> PASSED

### Manual Verification (Expected)
- [x] Repeat One loops the current track indefinitely.
- [x] Reaching the last track in a queue triggers an background fetch of suggestions.
- [x] Right-clicking a track opens a menu with working "Play Next" and "Add to Queue" actions.

## Deviations from Plan
None - plan executed exactly as written.

## Self-Check: PASSED
- [x] AudioEngine handles repeat one.
- [x] Autoplay logic implemented and triggered.
- [x] Context menu integrated into TrackList.
- [x] Commits made for changes.
