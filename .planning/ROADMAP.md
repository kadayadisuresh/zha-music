# Project Roadmap

## Phases

- [x] **Phase 1: Foundation & Auth** - Set up the core app, database, and Google authentication flow.
- [ ] **Phase 2: AudioEngine & InnerTube** - Implement direct YouTube CDN streaming via browser HTMLAudioElement.
- [ ] **Phase 3: Media Session + Gapless** - Add OS media controls and seamless track transitions.
- [ ] **Phase 4: Search & Browse** - Integrate ytmusicapi for catalog search and view.
- [ ] **Phase 5: Queue & Full Player UI** - Build complete playback controls, mini player, and queue management.
- [ ] **Phase 6: Home Feed + Charts + New Releases** - Provide dynamic and trending music feeds.
- [ ] **Phase 7: Library, Likes, Playlists, Follow** - Allow users to curate their personal music library.
- [ ] **Phase 8: Radio & Autoplay** - Generate endless playlists based on songs/artists.
- [ ] **Phase 9: Lyrics** - Display synchronized, tap-to-seek lyrics.
- [ ] **Phase 10: Sleep Timer & Crossfade** - Add playback customization settings.
- [ ] **Phase 11: Collaborative Playlists** - Enable real-time shared playlist editing.
- [ ] **Phase 12: Jam** - Build synchronized real-time listening sessions for up to 10 friends.
- [ ] **Phase 13: Blend** - Automatically compute daily shared playlists from user histories.
- [ ] **Phase 14: Downloads & Offline** - Support IndexedDB audio storage for offline playback.
- [ ] **Phase 15: Share Feature** - Implement sharing links using native and web APIs.
- [ ] **Phase 16: PWA & Polish** - Make the app installable, perfectly responsive, and performant.

## Phase Details

### Phase 1: Foundation & Auth
**Goal**: Core infrastructure is up and users can authenticate via Google.
**Depends on**: None
**Requirements**: AUTH-01, AUTH-02, AUTH-03, AUTH-04
**Success Criteria**:
  1. User can view the landing page.
  2. User can log in with their Google account and be redirected to the app.
  3. User's session persists via JWT cookie and profile info is retrieved.
  4. User can log out.
**Plans**: 4 plans
- [x] 01-01-PLAN.md — Backend Foundation & Database
- [x] 01-02-PLAN.md — Google OAuth & Session API
- [x] 01-03-PLAN.md — Frontend Foundation & Store
- [x] 01-04-PLAN.md — Authentication UI & Routing
**UI hint**: yes

### Phase 2: AudioEngine & InnerTube
**Goal**: Application can fetch stream URLs directly from YouTube and play them in the browser.
**Depends on**: Phase 1
**Requirements**: AUDIO-01, AUDIO-02
**Success Criteria**:
  1. Application correctly resolves stream URLs from YouTube without sending audio through backend.
  2. Audio starts playing in the browser with play/pause/seek controls.
  3. Errors like 403 or stream unavailability automatically retry or skip gracefully.
**Plans**: 3 plans
- [x] 02-01-PLAN.md — InnerTube Foundation & PO Token
- [ ] 02-02-PLAN.md — Audio Proxy (FastAPI)
- [ ] 02-03-PLAN.md — Playback State & AudioEngine

### Phase 3: Media Session + Gapless
**Goal**: Playback integrates with OS media controls and transitions between songs seamlessly.
**Depends on**: Phase 2
**Requirements**: AUDIO-03, AUDIO-04
**Success Criteria**:
  1. User can control playback via device lock screen or OS media keys.
  2. Track metadata (title, artist, artwork) is displayed correctly in OS media controls.
  3. Songs transition directly from one to the next without any silence (gapless playback).
**Plans**: TBD
**UI hint**: yes

### Phase 4: Search & Browse
**Goal**: Users can search the YouTube Music catalog and view artist/album details.
**Depends on**: Phase 2
**Requirements**: SEARCH-01, SEARCH-02
**Success Criteria**:
  1. User can search for songs, artists, albums, and playlists, and see results correctly.
  2. User can open an artist page and see their top songs, albums, and details.
  3. User can open an album page and view its full tracklist and release info.
**Plans**: TBD
**UI hint**: yes

### Phase 5: Queue & Full Player UI
**Goal**: Users have full control over the playback queue and can use the complete player interface.
**Depends on**: Phase 3, Phase 4
**Requirements**: PLAYER-01, PLAYER-02, PLAYER-03
**Success Criteria**:
  1. User can view a mini-player that expands into a full Now Playing screen (desktop & mobile).
  2. User can manage the queue (reorder, remove, play next).
  3. User can interact with playback context menus for songs.
**Plans**: TBD
**UI hint**: yes

### Phase 6: Home Feed + Charts + New Releases
**Goal**: Users land on a dynamic, personalized home screen and can browse global trends.
**Depends on**: Phase 4
**Requirements**: HOME-01, HOME-02, HOME-03
**Success Criteria**:
  1. User views a populated home feed with carousels for mixes, moods, and quick picks.
  2. User can navigate to a Charts page displaying top songs by region.
  3. User can navigate to a New Releases page displaying recent drops from followed artists and globally.
**Plans**: TBD
**UI hint**: yes

### Phase 7: Library, Likes, Playlists, Follow
**Goal**: Users can curate their personal library of liked content and custom playlists.
**Depends on**: Phase 1
**Requirements**: LIB-01, LIB-02, LIB-03
**Success Criteria**:
  1. User can like songs, save albums, and follow artists, viewing them in the Library tab.
  2. User can create, rename, edit the cover, and delete custom playlists.
  3. User can add, remove, and reorder songs within their custom playlists.
**Plans**: TBD
**UI hint**: yes

### Phase 8: Radio & Autoplay
**Goal**: Users can start endless playback from any song or artist, and queues continue automatically.
**Depends on**: Phase 5, Phase 7
**Requirements**: PLAY-01, PLAY-02
**Success Criteria**:
  1. User can select "Start radio" on any track or artist to populate the queue with related songs.
  2. When the user's queue ends, playback seamlessly continues with autoplay suggestions if enabled.
**Plans**: TBD

### Phase 9: Lyrics
**Goal**: Users can view and interact with synchronized lyrics for playing songs.
**Depends on**: Phase 5
**Requirements**: PLAY-03
**Success Criteria**:
  1. User can toggle a lyrics view in the Now Playing screen.
  2. Lyrics automatically scroll and highlight the currently sung line.
  3. User can tap on a specific lyric line to jump to that timestamp in the track.
**Plans**: TBD
**UI hint**: yes

### Phase 10: Sleep Timer & Crossfade
**Goal**: Users can customize their playback experience with sleep timers and crossfade transitions.
**Depends on**: Phase 5
**Requirements**: PLAY-04, PLAY-05
**Success Criteria**:
  1. User can set a sleep timer that pauses playback automatically after the set duration or song end.
  2. User can set a crossfade duration (e.g., 5s) and hear consecutive tracks seamlessly fade into one another.
**Plans**: TBD
**UI hint**: yes

### Phase 11: Collaborative Playlists
**Goal**: Users can invite others to manage and update a shared playlist in real-time.
**Depends on**: Phase 7
**Requirements**: SOC-01
**Success Criteria**:
  1. User can generate an invite link for a specific playlist.
  2. Invited users can join the playlist and add/remove songs.
  3. All collaborators see playlist changes applied instantly in real-time without refreshing.
**Plans**: TBD
**UI hint**: yes

### Phase 12: Jam
**Goal**: Users can create synchronized listening sessions with up to 10 friends.
**Depends on**: Phase 5
**Requirements**: SOC-02
**Success Criteria**:
  1. Host can create a Jam session and share a join code.
  2. Up to 9 other guests can join, and their playback stays perfectly synced with the host.
  3. Guests can add songs to the shared queue, which updates in real-time for everyone.
**Plans**: TBD
**UI hint**: yes

### Phase 13: Blend
**Goal**: Users can generate personalized shared playlists matching their tastes with a friend's.
**Depends on**: Phase 7
**Requirements**: SOC-03
**Success Criteria**:
  1. User can invite another user to a Blend playlist.
  2. Once accepted, a shared playlist is automatically generated using listening history.
  3. Blend playlist shows match percentage and auto-updates daily.
**Plans**: TBD
**UI hint**: yes

### Phase 14: Downloads & Offline
**Goal**: Users can download music to play when disconnected from the internet.
**Depends on**: Phase 2
**Requirements**: SYS-01
**Success Criteria**:
  1. User can click download on any track to save it offline via IndexedDB.
  2. User can play downloaded tracks even when the device is completely offline.
  3. User can view all downloaded tracks and manage storage/bulk delete from a downloads page.
**Plans**: TBD
**UI hint**: yes

### Phase 15: Share Feature
**Goal**: Users can easily share links to any content within the app.
**Depends on**: Phase 5
**Requirements**: SOC-04
**Success Criteria**:
  1. User can click a share button on any song, album, artist, or playlist.
  2. Native share sheet opens on mobile, or link is copied to clipboard on desktop.
  3. Opening a shared link correctly routes to the specific content page in the app.
**Plans**: TBD
**UI hint**: yes

### Phase 16: PWA & Polish
**Goal**: The application is fully installable, responsive, and performs like a native app.
**Depends on**: Phase 14
**Requirements**: SYS-02
**Success Criteria**:
  1. User is prompted and can install the app to their device home screen.
  2. Application passes all responsive checks (mobile, tablet, desktop, large desktop).
  3. Lighthouse PWA score is >= 90.
**Plans**: TBD
**UI hint**: yes

## Progress Tracker

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation & Auth | 4/4 | Complete | 2026-05-25 |
| 2. AudioEngine & InnerTube | 1/3 | In Progress|  |
| 3. Media Session + Gapless | 0/0 | Not started | - |
| 4. Search & Browse | 0/0 | Not started | - |
| 5. Queue & Full Player UI | 0/0 | Not started | - |
| 6. Home Feed + Charts + New Releases | 0/0 | Not started | - |
| 7. Library, Likes, Playlists, Follow | 0/0 | Not started | - |
| 8. Radio & Autoplay | 0/0 | Not started | - |
| 9. Lyrics | 0/0 | Not started | - |
| 10. Sleep Timer & Crossfade | 0/0 | Not started | - |
| 11. Collaborative Playlists | 0/0 | Not started | - |
| 12. Jam | 0/0 | Not started | - |
| 13. Blend | 0/0 | Not started | - |
| 14. Downloads & Offline | 0/0 | Not started | - |
| 15. Share Feature | 0/0 | Not started | - |
| 16. PWA & Polish | 0/0 | Not started | - |