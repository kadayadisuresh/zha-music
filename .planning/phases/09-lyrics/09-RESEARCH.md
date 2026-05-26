# Phase 9: Lyrics Research

## Features & Requirements
1. **Parsing:** LRC/ELRC format with word-level smoothing (80ms min highlight, merge <80ms). Fallback to line-level.
2. **Caching:** Backend API proxy for LRCLIB with 7-day DB cache (videoId key).
3. **Synchronization:**
   - Drift detection (5s check, auto-resync >2s drift over 400ms, instant snap >10s drift).
   - Sync offset (track-specific, persistent in lyrics_sync_offsets table, autosave 1s after slider interaction).
4. **UI:** 
   - Lyrics view with shimmer skeletons. 
   - Adaptive line highlighting (active line centered). 
   - Desktop full-screen expand button.
5. **Tech:** Zustand for lyric state management, Framer Motion for auto-scroll/transitions.

## API Integration
- LRCLIB API: https://lrclib.net/api/get?track_name=...&artist_name=...&album_name=...&duration=...

## Data Schema
- lyrics_sync_offsets: { id: int, track_id: string, offset_ms: int }

## Tech Stack Decisions
- Parsing: Custom robust parser implementation.
- State: Zustand useLyricsStore.
- Animation: Framer Motion AnimatePresence, motion.div.
- Caching: SQLAlchemy model + FastAPI proxy.
