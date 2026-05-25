# Project Requirements

## Authentication & Users
- `AUTH-01`: Google OAuth login, landing page, and JWT cookie setup.
- `AUTH-02`: User profile retrieval (`/auth/me`).
- `AUTH-03`: Logout functionality and session clearing.
- `AUTH-04`: JWT expiry handling (silently redirect to landing page).

## Audio Pipeline
- `AUDIO-01`: AudioEngine singleton with SSR guard and basic playback (play/pause/seek).
- `AUDIO-02`: InnerTube API direct browser integration for stream URLs (cache, error handling).
- `AUDIO-03`: Media Session API integration for OS lock screen controls.
- `AUDIO-04`: Gapless playback (preload next song 10s before end).

## Search & Discovery
- `SEARCH-01`: Unified search page (songs, artists, albums, playlists) via ytmusicapi.
- `SEARCH-02`: Artist and Album detail pages.

## Player UI & Queue
- `PLAYER-01`: Full playback controls and Queue management (shuffle, repeat, next/prev).
- `PLAYER-02`: Mini Player (bottom bar) with progress.
- `PLAYER-03`: Fullscreen Now Playing screen (desktop panel and mobile fullscreen).

## Home & Content
- `HOME-01`: Home Feed with horizontal rows (recommendations, moods).
- `HOME-02`: Charts page (global + regional).
- `HOME-03`: New Releases page.

## Library & Playlists
- `LIB-01`: Liked songs, Saved albums, and Followed artists functionality.
- `LIB-02`: Playlist CRUD (create, edit cover/name, delete, add/remove/reorder songs).
- `LIB-03`: Library overview page with sections.

## Playback Features
- `PLAY-01`: Song and Artist Radio generation via ytmusicapi.
- `PLAY-02`: Autoplay (trigger radio when queue ends).
- `PLAY-03`: Synced Lyrics via LRCLIB (auto-scroll, tap-to-seek).
- `PLAY-04`: Sleep timer functionality.
- `PLAY-05`: Crossfade between tracks (0-12s setting).

## Social & Collaboration
- `SOC-01`: Collaborative Playlists (invite, real-time sync).
- `SOC-02`: Jam Sessions (WebSocket, real-time control, max 10 people).
- `SOC-03`: Blend Playlists (daily compute, invite/accept).
- `SOC-04`: Share Feature (shareable URLs and Web Share API).

## Offline & Platform
- `SYS-01`: Downloads & Offline playback via IndexedDB.
- `SYS-02`: PWA installation (manifest, service worker) and responsive polish.

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | Phase 1 | Complete |
| AUTH-02 | Phase 1 | Complete |
| AUTH-03 | Phase 1 | Complete |
| AUTH-04 | Phase 1 | Complete |
| AUDIO-01 | Phase 2 | Pending |
| AUDIO-02 | Phase 2 | Pending |
| AUDIO-03 | Phase 3 | Pending |
| AUDIO-04 | Phase 3 | Pending |
| SEARCH-01 | Phase 4 | Pending |
| SEARCH-02 | Phase 4 | Pending |
| PLAYER-01 | Phase 5 | Pending |
| PLAYER-02 | Phase 5 | Pending |
| PLAYER-03 | Phase 5 | Pending |
| HOME-01 | Phase 6 | Pending |
| HOME-02 | Phase 6 | Pending |
| HOME-03 | Phase 6 | Pending |
| LIB-01 | Phase 7 | Pending |
| LIB-02 | Phase 7 | Pending |
| LIB-03 | Phase 7 | Pending |
| PLAY-01 | Phase 8 | Pending |
| PLAY-02 | Phase 8 | Pending |
| PLAY-03 | Phase 9 | Pending |
| PLAY-04 | Phase 10 | Pending |
| PLAY-05 | Phase 10 | Pending |
| SOC-01 | Phase 11 | Pending |
| SOC-02 | Phase 12 | Pending |
| SOC-03 | Phase 13 | Pending |
| SYS-01 | Phase 14 | Pending |
| SOC-04 | Phase 15 | Pending |
| SYS-02 | Phase 16 | Pending |