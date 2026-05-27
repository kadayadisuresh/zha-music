# Project Requirements

## Authentication & Users
- `AUTH-01`: Google OAuth login, landing page, and JWT cookie setup. [COMPLETE]
- `AUTH-02`: User profile retrieval (`/auth/me`). [COMPLETE]
- `AUTH-03`: Logout functionality and session clearing. [COMPLETE]
- `AUTH-04`: JWT expiry handling (silently redirect to landing page). [COMPLETE]

## Audio Pipeline
- `AUDIO-01`: AudioEngine singleton with SSR guard and basic playback. [COMPLETE]
- `AUDIO-02`: InnerTube API direct browser integration for stream URLs. [COMPLETE]
- `AUDIO-03`: Media Session API integration for OS lock screen controls. [COMPLETE]
- `AUDIO-04`: Gapless playback (preload next song 10s before end). [COMPLETE]

## Search & Discovery
- `SEARCH-01`: Unified search page via ytmusicapi. [COMPLETE]
- `SEARCH-02`: Artist and Album detail pages. [COMPLETE]

## Player UI & Queue
- `PLAYER-01`: Full playback controls and Queue management. [COMPLETE]
- `PLAYER-02`: Mini Player (bottom bar) with progress. [COMPLETE]
- `PLAYER-03`: Fullscreen Now Playing screen. [COMPLETE]

## Home & Content
- `HOME-01`: Home Feed with horizontal rows. [COMPLETE]
- `HOME-02`: Charts page (global + regional). [COMPLETE]
- `HOME-03`: New Releases page. [COMPLETE]

## Library & Playlists
- `LIB-01`: Liked songs, Saved albums, and Followed artists functionality. [COMPLETE]
- `LIB-02`: Playlist CRUD (create, edit, delete, reorder). [COMPLETE]
- `LIB-03`: Library overview page with sections. [COMPLETE]

## Playback Features
- `PLAY-01`: Song and Artist Radio generation via ytmusicapi. [COMPLETE]
- `PLAY-02`: Autoplay (trigger radio when queue ends). [COMPLETE]
- `PLAY-03`: Synced Lyrics via LRCLIB (auto-scroll, tap-to-seek). [COMPLETE]
- `PLAY-04`: Sleep timer functionality. [COMPLETE]
- `PLAY-05`: Crossfade between tracks (0-12s setting). [COMPLETE]

## Social & Collaboration
- `SOC-01`: Collaborative Playlists (invite, real-time sync). [COMPLETE]
- `SOC-02`: Jam Sessions (WebSocket, real-time control). [COMPLETE]
- `SOC-03`: Blend Playlists (daily compute, invite/accept). [COMPLETE]
- `SOC-04`: Share Feature (shareable URLs and Web Share API). [COMPLETE]

## Offline & Platform
- `SYS-01`: Downloads & Offline playback via IndexedDB. [COMPLETE]
- `SYS-02`: PWA installation and responsive polish. [COMPLETE]
