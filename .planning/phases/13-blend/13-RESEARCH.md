# Phase 13: Blend - Research

**Researched:** 2026-05-26
**Domain:** Music Recommendation / Collaborative Filtering
**Confidence:** MEDIUM

## Summary

Phase 13 focuses on creating a "Blend" feature that generates a shared playlist based on the intersection of two users' musical tastes. The process involves aggregating track, artist, and genre preferences from the existing `play_history` table, calculating a similarity score, and generating a shared playlist.

**Primary recommendation:** Use a Jaccard similarity index on artist/track IDs to calculate a "match score," and limit history window to the last 30 days to keep the playlist relevant.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Taste Analysis | API/Backend | — | Requires intensive database query access to `play_history` |
| Blend Generation | API/Backend | — | Needs to be atomic, efficient, and private |
| Playlist UI | Browser/Client | — | Rendering the shared playlist and metadata |
| Auto-update | API/Backend | — | Background tasks (e.g., Celery/task queue) for daily refresh |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| SQLAlchemy | [Assumed] | ORM | Already used in `backend/app/models/play_history.py` |
| Celery/APScheduler | [Assumed] | Task Queue | Essential for background jobs |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom Algo | Collaborative Filtering Libraries (e.g. Surprise) | Adds significant dependency weight; custom SQL aggregation is sufficient here. |

## Architecture Patterns

### Blend Generation Logic
1. **Fetch**: Retrieve `play_history` for two `user_id`s.
2. **Filter**: Apply time window (e.g., 30 days).
3. **Analyze**: Identify shared artists/genres and high-frequency tracks.
4. **Blend**: Interleave top tracks or select highly-rated mutual preferences.
5. **Persist**: Store as a `Playlist` object.

### Recommended Project Structure
```
backend/app/api/blend.py       # API Endpoints
backend/app/services/blend.py  # Generation Logic
```

## Gray Area Decisions (GADs)

| Decision | Option 1 (Simple) | Option 2 (Complex) | Recommended |
|----------|-------------------|-------------------|-------------|
| Match Calculation | Simple Jaccard Index | Weighted Vector Space | Jaccard (easier to explain) |
| Playlist Size | Fixed (e.g. 50) | Unbounded | Fixed (UI predictability) |
| History Window | Last 30 Days | Lifetime | Last 30 Days (dynamic blend) |

## Runtime State Inventory

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `play_history` table | Query optimization for `user_id` index |
| Live service config | None | N/A |
| OS-registered state | None | N/A |
| Secrets/env vars | None | N/A |
| Build artifacts | None | N/A |

## Common Pitfalls

- **Performance**: Scanning full history for two users will be slow as the `play_history` table grows. Ensure indexes on `user_id`.
- **Privacy**: Ensure the blend generation service doesn't return raw individual histories.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `play_history` table is sufficient for genre extraction | Blend | May need external API (e.g., Spotify/Last.fm) if genre is not tracked |

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Task Queue | Auto-update | ✗ | — | Scheduled API trigger |

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | pytest |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| BLEND-01 | Blend Generation | Unit | `pytest backend/tests/test_blend.py` | ❌ |

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V5 Input Validation | yes | SQLAlchemy/Pydantic |

## Sources

### Primary (HIGH confidence)
- `backend/app/models/play_history.py` - confirmed database model.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH
- Architecture: MEDIUM
- Pitfalls: HIGH

**Research date:** 2026-05-26
**Valid until:** 2026-06-25
