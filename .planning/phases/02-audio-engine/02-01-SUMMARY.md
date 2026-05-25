---
phase: 02-audio-engine
plan: 01
subsystem: InnerTube
tags: [innertube, po-token, stream-api]
requires: []
provides: [youtube-stream-urls]
affects: [audio-engine]
tech-stack: [youtubei.js, youtube-po-token-generator]
key-files: [frontend/lib/innertube/session.ts, frontend/app/api/innertube/stream/route.ts]
decisions:
  - use-youtube-po-token-generator: "Research showed this is the most reliable way to handle PO tokens server-side for YouTube."
  - singleton-session: "Maintained a global singleton session for InnerTube to share credentials and cache across requests."
metrics:
  duration: 45m
  completed_date: "2026-05-25"
---

# Phase 02 Plan 01: InnerTube & PO Token Summary

## Substantive One-liner
Implemented a reliable InnerTube session manager with background PO Token refresh and a secure API endpoint for resolving YouTube video IDs to playable audio stream URLs.

## Key Changes
- **InnerTube Session Manager**: Created a singleton `getInnertube()` function in `frontend/lib/innertube/session.ts` that handles initialization and caching.
- **PO Token Integration**: Integrated `youtube-po-token-generator` to generate valid `po_token` and `visitor_data` for YouTube requests, bypassing common "403 Forbidden" errors.
- **Background Refresh**: Added a 6-hour refresh loop for the PO Token to ensure session longevity.
- **Stream API**: Created `GET /api/innertube/stream` which validates video IDs and returns signed YouTube CDN URLs for the best available audio-only formats.

## Deviations from Plan
- **Rule 2 - Missing Functionality**: Added `youtube-po-token-generator` based on user research as it's more reliable than the built-in generator for some use cases.
- **Rule 1 - Bug**: Added explicit `videoId` regex validation to prevent abuse/injection.

## Self-Check: PASSED
- [x] Session singleton exists and works.
- [x] PO Token refresh logic implemented.
- [x] API route returns JSON with `url`.
- [x] Commits made for each task.
