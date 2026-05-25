---
phase: "03-media-session-gapless"
plan: "04"
subsystem: "Audio Engine"
tags: ["crossfade", "gapless", "transitions"]
requirements: ["AUDIO-04", "PLAY-05"]
key_files: ["frontend/lib/audio/AudioEngine.ts"]
---

# Phase 03 Plan 04: Micro-Crossfade Summary

Implemented seamless track transitions using a 200ms volume crossfade for automatic switches, while maintaining instant responsiveness for manual skips.

## Key Changes

- **Micro-Crossfade**: Added `switchTracks(automatic: boolean)` method.
  - Automatic transitions (triggered 200ms before track end) now use a smooth 200ms volume ramp to transition from the outgoing track to the incoming pre-fetched track.
  - Manual transitions (via UI or Media Session 'Next') remain instant for zero-latency feel.
- **Dual-Player Swap**: The `activeIdx` is swapped after the crossfade completes, and the outgoing player's `src` is cleared to free up resources.
- **Gapless Trigger**: The monitor loop triggers the crossfade exactly 200ms before the current track's duration is reached.
- **Media Session Integration**: Wired the Media Session 'next' action to the new `switchTracks(false)` logic.

## Decisions Made

- **200ms Duration**: Selected 200ms as the "sweet spot" for crossfades—long enough to eliminate "pops" and audible gaps, but short enough to feel snappy.
- **Volume Normalization**: The crossfade uses the user's current volume setting as the target, ensuring the ramp feels consistent.

## Verification Results

- **Gapless Playback**: Verified that sequential tracks play with no audible silence or interruption.
- **Manual Responsiveness**: Confirmed that clicking 'Next' results in an immediate track change without fading.
- **Resource Management**: Verified that the inactive player is correctly cleaned up after a switch.

## Self-Check: PASSED
