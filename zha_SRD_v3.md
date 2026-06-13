**ഴ-zha**

Software Requirements Document

YouTube Music Clone --- Private Web App

*Version 3.0 \| May 2026*

**READ THIS ENTIRE DOCUMENT BEFORE WRITING ANY CODE**

**1. Project Overview**

  --------------------- -------------------------------------------------
  **Field**             **Value**

  App Name              ഴ-zha (pronounced: zha)

  Type                  Free, private YouTube Music clone for browsers

  Audience              Solo developer + friends --- not public

  Platform              Pure web app --- every browser, every device, no
                        app store needed

  Install               Optional PWA install to home screen via browser
                        --- not mandatory

  Access                Just open the URL --- no download, no app store
  --------------------- -------------------------------------------------

**1.1 Mission Statement**

Build a clean, premium music streaming web app that feels exactly like
YouTube Music and SimpMusic but runs entirely in a browser. Audio
streams from YouTube\'s CDN via the InnerTube API --- called directly
from the browser --- with no audio ever touching the server. The app has
the Spotify Desktop layout (sidebar + main + now-playing panel),
supports mobile-first PWA installation, offline playback,
radio/autoplay, OS media controls, real-time Jam sessions, and Spotify
Blend.

**1.2 Platform & Browser Support**

  ------------------ ------------------ ---------------------------------
  **Browser**        **Minimum          **Notes**
                     Version**          

  Chrome             90+                Full support including PWA
                                        install and Media Session API

  Safari             14+                Background audio stops on iOS
                                        screen lock --- known iOS
                                        limitation

  Firefox            88+                Full support

  Edge               90+                Full support including PWA
                                        install
  ------------------ ------------------ ---------------------------------

Responsive breakpoints:

  ---------------- --------------- ---------------------------------------
  **Breakpoint**   **Width**       **Layout**

  Mobile           375px+          Bottom nav, mini player above nav,
                                   fullscreen now playing

  Tablet           768px+          Hybrid --- bottom nav + expanded
                                   content area

  Desktop          1024px+         Full 3-panel Spotify layout

  Large Desktop    1440px+         Wider content, larger album art
  ---------------- --------------- ---------------------------------------

**1.3 Key Design Principles**

- Audio NEVER passes through the server --- browser calls InnerTube
  directly

- Server (FastAPI) ONLY handles: auth, user data, playlists, likes,
  Jam/Blend state

- HTMLAudioElement only --- no Howler.js, no Web Audio API

- AudioEngine must have SSR guard: only instantiate in the browser
  (typeof window check)

- All components responsive: 375px, 768px, 1024px, 1440px+

- Fresh project --- no legacy code

- AbortController for all fetch cancellation

- Next.js 15 searchParams: always use useSearchParams() hook in client
  components

- Always pick opus/webm highest bitrate from InnerTube adaptiveFormats

- Everything syncs cross-device: likes, playlists, recently played,
  queue

- Media Session API: OS lock screen controls must work

- Gapless playback between songs in albums/playlists

**2. Technology Stack**

**2.1 Frontend**

  ------------------ ---------------------- -----------------------------
  **Layer**          **Technology**         **Notes**

  Framework          Next.js 15 (App        TypeScript strict mode
                     Router)                

  Styling            Tailwind CSS v4        No inline styles for layout

  State Management   Zustand                Stores: player, queue, user,
                                            library, jam, blend

  Audio Playback     HTMLAudioElement       Singleton AudioEngine,
                     (native)               SSR-guarded

  Offline Storage    IndexedDB (via idb     Downloaded songs, metadata
                     library)               

  Realtime           WebSocket (native      Jam + collaborative playlists
                     browser API)           

  PWA                next-pwa + Web App     Service Worker for offline
                     Manifest               cache

  HTTP Client        fetch +                No axios
                     AbortController        

  Auth               Google OAuth 2.0 (PKCE httpOnly cookies via FastAPI
                     flow)                  

  Media Controls     Media Session API      Lock screen + OS media
                                            controls
  ------------------ ---------------------- -----------------------------

**2.2 Backend**

  ------------------ ---------------------- -----------------------------
  **Layer**          **Technology**         **Notes**

  Framework          FastAPI (Python 3.12+) Async endpoints throughout

  Database           PostgreSQL 16          Primary data store

  ORM                SQLAlchemy 2.x (async) Alembic for migrations

  Auth               Google OAuth 2.0       JWT sessions, httpOnly
                                            cookies, 100 day expiry

  Realtime           WebSockets via FastAPI Jam + collaborative playlist
                                            sync

  Music API          ytmusicapi             Search, recommendations,
                                            radio, metadata

  Image Storage      Oracle Block Storage   Playlist + artist cover
                                            images

  Scheduler          APScheduler            Daily Blend cron at 00:00 UTC
  ------------------ ---------------------- -----------------------------

**2.3 External APIs**

  --------------------- ------------------------ -------------------------
  **API**               **Usage**                **Called From**

  InnerTube API         Stream URL resolution    BROWSER ONLY --- never
  (YouTube)                                      server

  YouTube CDN           Audio stream delivery    Browser directly

  ytmusicapi            Search, browse, radio,   FastAPI backend
                        recommendations          

  LRCLIB                Synced lyrics (LRC       Frontend --- public, no
                        format)                  auth

  Google OAuth 2.0      User authentication      Frontend initiates,
                                                 backend validates

  Media Session API     OS lock screen controls  Browser --- built in, no
                                                 library needed
  --------------------- ------------------------ -------------------------

**2.4 Hosting**

  ----------------------------------- -----------------------------------
  **Service**                         **What runs there**

  Oracle Cloud Free Tier --- Compute  FastAPI backend + PostgreSQL

  Oracle Cloud Free Tier --- Block    Playlist cover images
  Storage                             

  Vercel (recommended) or Oracle      Next.js frontend
  ----------------------------------- -----------------------------------

**3. System Architecture**

**3.1 Audio Pipeline (Critical --- Read First)**

No audio bytes may ever pass through the FastAPI server. The complete
flow:

- 1\. User presses Play

- 2\. Browser calls InnerTube API directly to get stream URL

- 3\. Browser sets HTMLAudioElement.src to YouTube CDN URL

- 4\. Audio streams: Browser \<-\> YouTube CDN --- FastAPI not involved

- 5\. Stream URL cached in sessionStorage for 4 hours

- 6\. Media Session API updated with track metadata for OS controls

- 7\. Next 3 songs prefetched silently while current song plays

- 8\. On song end: gapless transition to next song (preload next src
  before end)

**3.2 InnerTube Integration**

  --------------------- -------------------------------------------------
  **Field**             **Value**

  Endpoint              https://music.youtube.com/youtubei/v1/player

  Method                POST

  API Key               AIzaSyC9XL3ZjWddXya6X74dJoCTL-KLET5YdCE (public
                        web key --- no auth needed)

  Primary Client        WEB_REMIX / clientVersion: 1.20240101.00.00

  Fallback Client       ANDROID_MUSIC / clientVersion: 5.28.1 /
                        androidSdkVersion: 30

  signatureTimestamp    19369

  Audio Format          ALWAYS opus/webm highest bitrate from
                        adaptiveFormats

  Cache Key             innertube:{videoId} in sessionStorage

  Cache TTL             4 hours --- never play expired URL, always
                        refetch

  Error Code 4          Refetch stream URL once from InnerTube before
                        skipping

  Rate Limit            Silent exponential backoff: 1s, 2s, 4s --- never
                        show error to user
  --------------------- -------------------------------------------------

Required request headers:

- User-Agent: Mozilla/5.0

- X-YouTube-Client-Name: 67

- X-YouTube-Client-Version: 1.20240101.00.00

- Origin: https://music.youtube.com

- Referer: https://music.youtube.com/

**3.3 Media Session API**

The Media Session API connects the web app to the OS --- enabling lock
screen controls, notification controls, and hardware media keys. This is
what makes it feel like a native app.

- Update navigator.mediaSession.metadata on every song change: title,
  artist, album, artwork

- Set action handlers: play, pause, previoustrack, nexttrack, seekto,
  seekbackward, seekforward

- Update navigator.mediaSession.playbackState: \'playing\' or \'paused\'

- Update navigator.mediaSession.setPositionState on timeupdate:
  duration, playbackRate, position

This enables: phone lock screen controls, Android notification controls,
Bluetooth headphone buttons, keyboard media keys on desktop.

**3.4 Gapless Playback**

Gapless playback means no silence between tracks --- essential for
albums.

- When current song has 10 seconds remaining, preload next song\'s
  stream URL

- Create a second HTMLAudioElement, set src to next song URL, call
  load()

- On current song end, immediately swap to the preloaded element

- This creates seamless gapless transitions between songs

**3.5 Backend Responsibilities (FastAPI Only)**

  --------------------- ----------------------------------------------------
  **Endpoint Group**    **Responsibility**

  /auth/\*              Google OAuth flow, JWT issuance, session management

  /users/\*             Profile, history, recently played, cross-device
                        queue sync, user search

  /playlists/\*         CRUD playlists, songs, collaborative invites

  /likes/\*             Like/unlike tracks and albums, fetch liked items

  /library/\*           Followed artists, saved albums

  /jam/\*               Create/join/leave Jam sessions, WebSocket hub,
                        enforce max 10

  /blend/\*             Blend computation, daily cron, invite/accept flow

  /search/\*            Proxy to ytmusicapi (metadata only, never audio)

  /recommendations/\*   Home feed, charts, new releases from ytmusicapi

  /radio/\*             Song radio and artist radio via ytmusicapi
  --------------------- ----------------------------------------------------

**4. Design System**

**4.1 Color Palette**

  --------------------- ------------- ----------------------------------------
  **Token**             **Hex**       **Usage**

  \--bg-primary         #000000       App background --- pure black

  \--bg-surface         #111111       Cards, sidebar, panels

  \--bg-elevated        #1A1A1A       Hover states, modals, context menus

  \--accent-primary     #F5F0E8       Ivory cream --- primary text, active
                                      states, progress bar

  \--accent-secondary   #D4C9B0       Subtext, labels, muted elements

  \--border             #333333       Dividers, input borders

  \--error              #FF4C4C       Error states, unavailable songs

  \--success            #4CAF7A       Success states, download complete
  --------------------- ------------- ----------------------------------------

**4.2 Logo**

The logo is the Malayalam character ഴ displayed alone everywhere. No
wordmark. No English text next to it. Just ഴ in ivory cream on pure
black.

**4.3 Layout --- Desktop (1024px+)**

  --------------- ------------- ------------------------------------------
  **Zone**        **Width**     **Content**

  Left Sidebar    240px fixed   Logo (ഴ), nav links, Library section,
                                playlists list

  Main Content    flex: 1       All pages render here: home, search,
                                album, artist, playlist, library

  Now Playing     380px fixed   Album art, controls, lyrics panel, queue
  Panel                         panel (toggle)

  Bottom Bar      Full width    Mini player --- exactly like YouTube Music
                  90px          with thin progress bar at top
  --------------- ------------- ------------------------------------------

**4.4 Layout --- Mobile (375px --- 768px)**

  ------------------ ----------------------------------------------------
  **Zone**           **Behaviour**

  Bottom Nav Bar     5 icons: Home, Search, Library, Jam, Profile

  Mini Player        Sits above bottom nav --- album art, title, artist,
                     play/pause, next, progress bar at top

  Now Playing        Full screen on tap --- swipe down to dismiss, swipe
                     left for lyrics

  Sidebar            Hidden --- all navigation via bottom bar
  ------------------ ----------------------------------------------------

**4.5 Animation & Motion**

- Transitions: 200ms ease for hover/focus states

- Page transitions: 300ms fade-slide

- Now Playing panel: 350ms slide-in from right (desktop)

- Mobile fullscreen: 400ms slide-up from bottom

- No animations during seek --- immediate response

- Skeleton loaders on ALL async data --- never blank pages

**5. Feature Specifications**

**5.1 Onboarding / Landing Page**

Shown to unauthenticated users only. Contains:

- Logo ഴ centered, large

- Tagline: \'Your personal YouTube Music. Free. Private. For you and
  your friends.\'

- \'Continue with Google\' button

- Pure black background, ivory cream text

- After login: redirect to home feed

**5.2 Authentication**

- Google OAuth 2.0 PKCE flow --- no email/password

- FastAPI issues JWT in httpOnly Secure SameSite=Strict cookie

- JWT expires after 100 days --- on expiry: silently redirect to landing
  page, no toast

- Frontend checks /auth/me on every load to restore session

- Profile page: Google avatar + display name + email --- read only, no
  editing

**5.3 Search**

  ---------------------- ------------------------------------------------
  **Search Type**        **Endpoint**

  All                    GET /search?q=x

  Songs                  GET /search?q=x&type=songs

  Artists                GET /search?q=x&type=artists

  Albums                 GET /search?q=x&type=albums

  Playlists              GET /search?q=x&type=playlists
  ---------------------- ------------------------------------------------

- Debounce: 300ms before firing

- Skeleton loaders while fetching

- Recent searches in localStorage

- Empty state: \'No results found for X\' --- no suggestions

- Use useSearchParams() hook --- never access searchParams prop directly
  (Next.js 15 rule)

**5.4 Player & Queue**

**[AudioEngine (Singleton)]{.underline}**

- SSR guard: typeof window === \'undefined\' check before instantiation

- Only one HTMLAudioElement for current song + one preloaded for gapless
  next song

- Exposes: play(url), pause(), resume(), seek(seconds), setVolume(0-1)

- Events: onProgress, onEnded, onError, onBuffering

- On ended: gapless swap to preloaded next song, then prefetch the one
  after

- On error code 4: refetch InnerTube URL once, if still fails: toast +
  skip after 2s

- On rate limit: silent exponential backoff 1s/2s/4s

- Media Session API: update metadata + handlers on every song change

**[Playback Controls]{.underline}**

  --------------------- -------------------------------------------------
  **Control**           **Behaviour**

  Play/Pause            Toggle current track

  Skip Next             Advance queue; if repeat=one replay; if end and
                        autoplay on: start radio

  Skip Prev             If \>3s played: restart. If \<3s: go to previous.

  Seek                  Drag or click progress bar --- immediate, no
                        animation

  Volume                0-100 slider, stored in localStorage, mute toggle

  Shuffle               Randomize remaining queue, remember original
                        order to unshuffle

  Repeat                Off \> Repeat All \> Repeat One \> Off

  Autoplay/Radio        When queue ends, auto-generate related songs via
                        song radio

  Sleep Timer           Stop playback after 15, 30, 45, 60 minutes or end
                        of current song

  Crossfade             0-12 second crossfade between songs (setting,
                        default 0)
  --------------------- -------------------------------------------------

**[Mini Player (Bottom Bar) --- Exactly Like YouTube
Music]{.underline}**

- Thin progress bar at very top of the bar (full width, scrubbable)

- Small album art square

- Song title + artist name (truncated)

- Play/pause button

- Next button

- Tap anywhere (except buttons) to open full Now Playing screen

**[Queue Management]{.underline}**

- Slide-in panel from right (desktop) / bottom sheet (mobile)

- Drag to reorder

- Remove individual songs

- Add to play next (inserts after current)

- Add to end of queue

- Clear queue button

- Shows: currently playing (highlighted), up next, autoplay suggestions

**[Context Menu (right-click / long-press on any song)]{.underline}**

- Play now

- Add to queue

- Add to next

- Add to playlist

- Like / Unlike

- Download

- Share (copy link + native share sheet)

- Start song radio

- Go to artist

- Go to album

- Remove from playlist (only inside playlist view)

- Remove from queue (only inside queue panel)

**5.5 Home Feed**

Fetched from FastAPI /recommendations --- calls ytmusicapi.get_home()

- Quick Picks --- personalized tracks

- Mixed For You --- mood/radio mixes

- Trending --- trending in user region

- Moods & Genres --- curated cards: Party, Workout, Sleep, Focus,
  Commute, etc.

- Recently Played --- last 20 tracks/albums/playlists

- New Releases --- new albums from followed artists

- Charts --- link to Charts page

Each section: horizontally scrollable card row with CSS scroll-snap.

**5.6 Charts Page**

- Top 100 songs globally

- Top 100 by country (based on user region)

- Fetched from ytmusicapi charts endpoint

- Each song: rank, thumbnail, title, artist, plays, trending indicator
  (up/down/new)

**5.7 New Releases Page**

- Latest albums and singles released this week

- Filtered by followed artists (if any) + general new releases

- Fetched from ytmusicapi

**5.8 Now Playing Screen**

**[Desktop Now Playing Panel (right sidebar 380px)]{.underline}**

- Large album art (\~240px square)

- Track title + artist name

- Like button (heart)

- Scrubable progress bar with current time / total duration

- Controls: shuffle, prev, play/pause, next, repeat

- Autoplay toggle button

- Sleep timer button

- Volume slider + mute

- Queue toggle button (slides queue in from right)

- Lyrics toggle button

**[Mobile Fullscreen Now Playing]{.underline}**

- Full screen on tap from mini player

- Swipe down to dismiss

- Swipe left from album art to open lyrics

- Same controls as desktop

**5.9 Radio & Autoplay**

Radio generates an endless playlist of related songs. This is how
YouTube Music always keeps playing.

**[Song Radio]{.underline}**

- Right-click/long-press any song \> \'Start song radio\'

- Calls ytmusicapi.get_watch_playlist(videoId) to get related songs

- Adds related songs to queue, continues playing

**[Artist Radio]{.underline}**

- On any artist page \> \'Start artist radio\'

- Calls ytmusicapi.get_artist_songs(channelId) for seed, then
  get_watch_playlist

**[Autoplay (queue end)]{.underline}**

- When queue ends and autoplay is ON (default: on): automatically start
  song radio from last played song

- Autoplay toggle in now playing panel

- When autoplay is OFF: playback stops at end of queue

**5.10 Artist Page**

Full artist page exactly like YouTube Music:

- Artist header image + name + subscriber count

- Shuffle button + \'Start artist radio\' button

- Follow artist button (saves to library, shows in New Releases)

- Top songs list (top 5, expandable to top 20)

- Albums grid (with release year)

- Singles & EPs grid

- Videos section

- Fans also like --- related artists

- About section (bio, country, links)

**5.11 Album Page**

Full album page exactly like YouTube Music:

- Album art + title + artist + release year + total duration + track
  count

- Play all button + Shuffle button

- Like album / Save to library button

- Track list: number, title, duration, like button, context menu

- More from this artist section at the bottom

**5.12 Lyrics**

Source: LRCLIB API --- https://lrclib.net/api

GET
https://lrclib.net/api/get?artist_name={artist}&track_name={title}&album_name={album}&duration={seconds}

- Word-by-word synced lyrics if available (karaoke style)

- Line-level fallback if word timestamps not available

- Active line: \--accent-primary color, scale(1.05), centered vertically

- Inactive lines: \--accent-secondary, 70% opacity

- Auto-scroll: active line stays centered in viewport

- Tap any line to seek to that timestamp

- If no synced lyrics: show plain text

- If no lyrics at all: \'Lyrics not available\'

**5.13 Library**

  ---------------- ------------------------- -----------------------------
  **Section**      **Content**               **Sort Options**

  Liked Songs      All liked tracks          Date added, Title, Artist

  Saved Albums     Albums user saved         Date saved, Title, Artist

  Followed Artists Artists user follows      Date followed, Name

  Playlists        User playlists +          Date created, Name, Recently
                   collaborative             played

  Recently Played  Last 50                   Chronological only
                   tracks/albums/playlists   

  Downloads        Tracks in IndexedDB       Date downloaded, Title
  ---------------- ------------------------- -----------------------------

**5.14 Playlists**

- Create: name (required), description (optional), cover image
  (optional)

- Cover image stored on Oracle Block Storage

- Edit: rename, description, replace cover

- Delete: confirmation dialog

- Add song: from context menu \> \'Add to playlist\' \> choose

- Reorder: drag handle (desktop) / long-press drag (mobile)

- Duplicate detection: warn if song already in playlist, allow override

**[Collaborative Playlists]{.underline}**

- Owner invites via shareable link (invite token, 7 day expiry)

- Friends also findable via username search inside app

- Collaborators can add/remove/reorder songs

- Real-time sync via WebSocket: song_added, song_removed,
  song_reordered, playlist_renamed

- Optimistic UI: apply locally, revert on server error

**5.15 Blend**

Combines two users\' listening histories into a shared playlist. Updates
daily. Identical to Spotify Blend.

- Invite via username search or shareable link

- Daily cron at 00:00 UTC recomputes playlist

- Algorithm: top 50 tracks per user (last 30 days), cosine similarity
  scoring, top 30 alternating A/B preference

- Minimum 10 plays required per user --- else show \'Not enough
  listening data yet --- keep listening!\'

- UI: overlapping avatars, match %, per-track attribution, \'Refreshes
  daily\' label

**5.16 Jam**

Shared real-time listening session. Host controls playback. Guests can
add to queue. Max 10 people. Identical to Spotify Jam.

- Host: POST /jam/create --- gets session_id + join_code

- Invite via shareable link OR username search

- All connect to WebSocket: wss://api/jam/{session_id}

- Host leaving ends session for everyone

- Max 10 participants enforced server-side

**[WebSocket Events]{.underline}**

  ----------------------- ------------------ ---------------------------------
  **Event**               **Direction**      **Payload**

  jam:play                Host \> Server \>  { videoId, position_seconds }
                          All                

  jam:pause               Host \> Server \>  { position_seconds }
                          All                

  jam:seek                Host \> Server \>  { position_seconds }
                          All                

  jam:next                Host \> Server \>  { videoId }
                          All                

  jam:queue_add           Any \> Server \>   { videoId, addedBy }
                          All                

  jam:participant_join    Server \> All      { userId, displayName, avatar }

  jam:participant_leave   Server \> All      { userId }

  jam:sync_state          Server \> New      { currentVideoId, position,
                          Guest              isPlaying, queue }

  jam:session_ended       Server \> All      {}
                          Guests             
  ----------------------- ------------------ ---------------------------------

**5.17 Share**

- Every song, album, artist, playlist has a shareable URL

- Song: zha.yoursite.com/song/{videoId}

- Artist: zha.yoursite.com/artist/{browseId}

- Album: zha.yoursite.com/album/{browseId}

- Playlist: zha.yoursite.com/playlist/{id}

- Share button opens: native Web Share API (mobile) + copy link button
  (all devices)

**5.18 Toast Notifications**

  ------------------------------ ----------------------------------------
  **Action**                     **Toast Message**

  Like a song                    Liked

  Unlike a song                  Removed from liked songs

  Add to queue                   Added to queue

  Start download                 Downloading\...

  Download complete              Download complete

  Song unavailable               Song unavailable --- skipping (auto-skip
                                 after 2s)

  Playlist created               Playlist created

  Added to playlist              Added to {playlist name}

  Follow artist                  Following {artist name}

  Save album                     Album saved to library

  Jam session full               Session is full --- max 10 people

  Session expired                (silent redirect to landing page --- no
                                 toast)
  ------------------------------ ----------------------------------------

**5.19 Downloads & Offline**

- Download icon on every track

- Frontend fetches stream URL via InnerTube, downloads as ArrayBuffer,
  stores in IndexedDB

- IndexedDB key: videoId, value: { audioBuffer, metadata, downloadedAt }

- AudioEngine checks IndexedDB FIRST before calling InnerTube

- Offline playback: Blob URL from ArrayBuffer, revoked on song end

- Warn at 80% storage quota via navigator.storage.estimate()

- Downloads page: list with art, title, size, date, delete button

- Bulk delete by selecting multiple tracks

- Auto-cleanup: delete tracks not played in 30 days (opt-in setting)

**5.20 Sleep Timer**

- Options: 15 min, 30 min, 45 min, 60 min, End of current song

- Timer shown in now playing panel when active

- Countdown visible: \'14:32 remaining\'

- Cancel button to stop the timer

- On timer end: fade out audio over 3 seconds, then stop

**5.21 Crossfade**

- Setting in player settings: 0-12 seconds (default: 0 = gapless only)

- When \> 0: current song fades out, next song fades in simultaneously

- Implemented by controlling HTMLAudioElement volume over time

**5.22 PWA**

- name: \'ഴ-zha\', short_name: \'zha\', display: \'standalone\'

- Theme color: #000000, background: #000000

- Icons: 192x192 and 512x512 PNG (use ഴ character as icon)

- Service Worker via next-pwa: cache app shell and static assets

- Offline fallback page when no cache and no network

- Custom \'Install App\' button via beforeinstallprompt event

- Downloaded songs playable fully offline

**6. Database Schema**

**users**

  --------------------- --------------------- ----------------------------
  **Column**            **Type**              **Notes**

  id                    UUID PK               

  google_id             VARCHAR(128) UNIQUE   

  email                 VARCHAR(320) UNIQUE   

  display_name          VARCHAR(200)          

  avatar_url            TEXT                  

  crossfade_seconds     SMALLINT              DEFAULT 0

  autoplay_enabled      BOOLEAN               DEFAULT true

  created_at            TIMESTAMPTZ           DEFAULT NOW()

  last_seen_at          TIMESTAMPTZ           
  --------------------- --------------------- ----------------------------

**playlists**

  --------------------- --------------------- ----------------------------
  **Column**            **Type**              **Notes**

  id                    UUID PK               

  owner_id              UUID FK \> users.id   

  name                  VARCHAR(200)          

  description           TEXT                  NULLABLE

  cover_image_url       TEXT                  NULLABLE --- Oracle Block
                                              Storage

  is_collaborative      BOOLEAN               DEFAULT false

  is_blend              BOOLEAN               DEFAULT false

  created_at            TIMESTAMPTZ           DEFAULT NOW()

  updated_at            TIMESTAMPTZ           
  --------------------- --------------------- ----------------------------

**playlist_songs**

  --------------------- --------------------- ----------------------------
  **Column**            **Type**              **Notes**

  id                    UUID PK               

  playlist_id           UUID FK \>            
                        playlists.id CASCADE  
                        DELETE                

  video_id              VARCHAR(16)           YouTube video ID

  title                 VARCHAR(500)          Cached

  artist                VARCHAR(500)          

  album                 VARCHAR(500)          NULLABLE

  thumbnail_url         TEXT                  

  duration_seconds      INTEGER               

  position              INTEGER               Gaps: 1000, 2000, 3000

  added_by              UUID FK \> users.id   

  added_at              TIMESTAMPTZ           DEFAULT NOW()
  --------------------- --------------------- ----------------------------

**likes**

  --------------------- --------------------- ----------------------------
  **Column**            **Type**              **Notes**

  user_id               UUID FK \> users.id   

  video_id              VARCHAR(16)           

  title                 VARCHAR(500)          

  artist                VARCHAR(500)          

  thumbnail_url         TEXT                  

  duration_seconds      INTEGER               

  liked_at              TIMESTAMPTZ           DEFAULT NOW()

  PRIMARY KEY           (user_id, video_id)   
  --------------------- --------------------- ----------------------------

**saved_albums**

  --------------------- --------------------- ----------------------------
  **Column**            **Type**              **Notes**

  user_id               UUID FK \> users.id   

  browse_id             VARCHAR(64)           YouTube Music browseId

  title                 VARCHAR(500)          

  artist                VARCHAR(500)          

  thumbnail_url         TEXT                  

  year                  VARCHAR(10)           

  saved_at              TIMESTAMPTZ           DEFAULT NOW()

  PRIMARY KEY           (user_id, browse_id)  
  --------------------- --------------------- ----------------------------

**followed_artists**

  --------------------- --------------------- ----------------------------
  **Column**            **Type**              **Notes**

  user_id               UUID FK \> users.id   

  channel_id            VARCHAR(64)           YouTube Music channelId

  name                  VARCHAR(500)          

  thumbnail_url         TEXT                  

  followed_at           TIMESTAMPTZ           DEFAULT NOW()

  PRIMARY KEY           (user_id, channel_id) 
  --------------------- --------------------- ----------------------------

**play_history**

  ----------------------- --------------------- ----------------------------
  **Column**              **Type**              **Notes**

  id                      UUID PK               

  user_id                 UUID FK \> users.id   

  video_id                VARCHAR(16)           

  title                   VARCHAR(500)          

  artist                  VARCHAR(500)          

  thumbnail_url           TEXT                  

  played_at               TIMESTAMPTZ           DEFAULT NOW()

  play_duration_seconds   INTEGER               Seconds actually listened
  ----------------------- --------------------- ----------------------------

**playlist_collaborators**

  --------------------- --------------------- ----------------------------
  **Column**            **Type**              **Notes**

  playlist_id           UUID FK \>            
                        playlists.id CASCADE  
                        DELETE                

  user_id               UUID FK \> users.id   

  invited_by            UUID FK \> users.id   

  joined_at             TIMESTAMPTZ           DEFAULT NOW()

  PRIMARY KEY           (playlist_id,         
                        user_id)              
  --------------------- --------------------- ----------------------------

**blends**

  --------------------- --------------------- ----------------------------
  **Column**            **Type**              **Notes**

  id                    UUID PK               

  user_a_id             UUID FK \> users.id   Initiator

  user_b_id             UUID FK \> users.id   Invited user

  playlist_id           UUID FK \>            Generated Blend playlist
                        playlists.id          

  match_percentage      SMALLINT              0-100

  last_computed_at      TIMESTAMPTZ           

  created_at            TIMESTAMPTZ           DEFAULT NOW()
  --------------------- --------------------- ----------------------------

**jam_sessions**

  -------------------------- --------------------- ----------------------------
  **Column**                 **Type**              **Notes**

  id                         UUID PK               

  host_id                    UUID FK \> users.id   

  join_code                  VARCHAR(8) UNIQUE     Random alphanumeric

  current_video_id           VARCHAR(16)           NULLABLE

  current_position_seconds   REAL                  

  is_playing                 BOOLEAN               DEFAULT false

  participant_count          INTEGER               DEFAULT 1, max 10

  created_at                 TIMESTAMPTZ           DEFAULT NOW()

  ended_at                   TIMESTAMPTZ           NULLABLE --- NULL = active
  -------------------------- --------------------- ----------------------------

**7. API Specification**

**7.1 Auth**

  ------------ ----------------------- ------------------------------ ------------
  **Method**   **Path**                **Description**                **Auth
                                                                      Required**

  GET          /auth/google            Redirect to Google consent     No

  GET          /auth/google/callback   Handle OAuth, set JWT cookie   No

  GET          /auth/me                Return current user            Yes

  DELETE       /auth/session           Logout, clear cookie           Yes
  ------------ ----------------------- ------------------------------ ------------

**7.2 Search & Discovery**

  ------------ --------------------- ------------------------------------------
  **Method**   **Path**              **Description**

  GET          /search?q=&type=      Search via ytmusicapi

  GET          /recommendations      Home feed from ytmusicapi.get_home()

  GET          /artists/{browseId}   Artist detail + discography

  GET          /albums/{browseId}    Album detail + tracklist

  GET          /charts               Top 100 global + regional charts

  GET          /new-releases         New releases this week

  GET          /users/search?q=      Search users by display name
  ------------ --------------------- ------------------------------------------

**7.3 Radio**

  ------------ --------------------------- ------------------------------------------
  **Method**   **Path**                    **Description**

  GET          /radio/song/{videoId}       Song radio --- get related songs playlist

  GET          /radio/artist/{channelId}   Artist radio --- get artist-based playlist
  ------------ --------------------------- ------------------------------------------

**7.4 Playlists**

  ------------ -------------------------------------- ---------------------------------------
  **Method**   **Path**                               **Description**

  GET          /playlists                             List user playlists

  POST         /playlists                             Create playlist

  GET          /playlists/{id}                        Get playlist with songs

  PATCH        /playlists/{id}                        Update name/description/cover

  DELETE       /playlists/{id}                        Delete playlist

  POST         /playlists/{id}/songs                  Add song

  DELETE       /playlists/{id}/songs/{songId}         Remove song

  PATCH        /playlists/{id}/songs/reorder          Reorder songs

  POST         /playlists/{id}/collaborators/invite   Generate invite token

  POST         /playlists/{id}/collaborators/join     Join via token

  WS           /playlists/ws/{id}                     Real-time playlist sync
  ------------ -------------------------------------- ---------------------------------------

**7.5 Library**

  ------------ ------------------------------ ---------------------------------------
  **Method**   **Path**                       **Description**

  GET          /likes                         Get liked tracks

  POST         /likes/{videoId}               Like track

  DELETE       /likes/{videoId}               Unlike track

  GET          /library/albums                Get saved albums

  POST         /library/albums/{browseId}     Save album

  DELETE       /library/albums/{browseId}     Unsave album

  GET          /library/artists               Get followed artists

  POST         /library/artists/{channelId}   Follow artist

  DELETE       /library/artists/{channelId}   Unfollow artist
  ------------ ------------------------------ ---------------------------------------

**7.6 Jam**

  ------------ ------------------------ ---------------------------------------
  **Method**   **Path**                 **Description**

  POST         /jam/create              Create session --- returns {
                                        session_id, join_code }

  POST         /jam/join/{joinCode}     Join session (enforces max 10)

  DELETE       /jam/{sessionId}         End session (host only)

  WS           /jam/ws/{sessionId}      WebSocket real-time sync
  ------------ ------------------------ ---------------------------------------

**7.7 Blend**

  ------------ ------------------------- ---------------------------------------
  **Method**   **Path**                  **Description**

  POST         /blend/invite/{userId}    Invite user to Blend

  POST         /blend/accept/{blendId}   Accept Blend invite

  GET          /blend/{blendId}          Get Blend playlist + match %

  DELETE       /blend/{blendId}          Leave/delete Blend
  ------------ ------------------------- ---------------------------------------

**7.8 User Data**

  ------------ ------------------------ ---------------------------------------
  **Method**   **Path**                 **Description**

  GET          /users/me/history        Play history (paginated)

  POST         /users/me/history        Record a play

  GET          /users/me/top-tracks     Top 50 tracks last 30 days (Blend)

  GET          /users/me/queue          Get cross-device synced queue

  PUT          /users/me/queue          Update synced queue

  GET          /users/me/settings       Get user settings (crossfade, autoplay,
                                        etc.)

  PUT          /users/me/settings       Update settings
  ------------ ------------------------ ---------------------------------------

**8. Frontend File Structure**

zha/

app/

layout.tsx Root layout: sidebar + now playing panel

page.tsx Home feed

search/page.tsx Search (uses useSearchParams())

artist/\[browseId\]/page.tsx Full artist page

album/\[browseId\]/page.tsx Full album page

playlist/\[id\]/page.tsx Playlist view

library/page.tsx Library tabs

downloads/page.tsx Downloads + storage usage

jam/page.tsx Jam session UI

jam/\[code\]/page.tsx Join Jam via code

blend/\[id\]/page.tsx Blend playlist

charts/page.tsx Charts page

new-releases/page.tsx New releases

profile/page.tsx User profile

components/

layout/

Sidebar.tsx

NowPlayingPanel.tsx

MobileBottomNav.tsx

MobileNowPlaying.tsx

player/

PlayerControls.tsx

ProgressBar.tsx

VolumeControl.tsx

QueuePanel.tsx

MiniPlayer.tsx

SleepTimer.tsx

lyrics/

LyricsView.tsx

cards/

TrackCard.tsx

AlbumCard.tsx

ArtistCard.tsx

PlaylistCard.tsx

feed/

HomeFeedSection.tsx

MoodCard.tsx

jam/

JamSession.tsx

ParticipantList.tsx

ui/

Button.tsx

Modal.tsx

ContextMenu.tsx

Skeleton.tsx

Toast.tsx

ShareSheet.tsx

lib/

audio/

AudioEngine.ts Singleton --- SSR guarded

innertube.ts InnerTube API --- browser only

mediaSession.ts Media Session API handler

gapless.ts Gapless playback preloader

api/

client.ts FastAPI fetch wrapper

lyrics/

lrclib.ts LRCLIB fetch + LRC parser

db/

indexeddb.ts idb wrapper for downloads

ws/

jamSocket.ts WebSocket client for Jam

playlistSocket.ts WebSocket client for collab playlists

stores/

playerStore.ts currentTrack, isPlaying, position, volume

queueStore.ts queue\[\], currentIndex, autoplay, shuffle, repeat

userStore.ts user profile, auth state, settings

libraryStore.ts likes, playlists, albums, artists, downloads

jamStore.ts session, participants, isHost

blendStore.ts blend data

hooks/

useAudio.ts

useLyrics.ts

useJam.ts

useDownload.ts

useToast.ts

useMediaSession.ts

useGapless.ts

public/

manifest.json

icons/ PWA icons 192x192, 512x512

sw.js Service Worker (via next-pwa)

next.config.ts

tailwind.config.ts

**9. Build Phases**

Each phase: Research \> Plan \> Build \> Test. Move to next ONLY when
current phase is fully working.

  ----------- ---------------- -------------------------------------------------
  **Phase**   **Name**         **What Gets Built**

  1           Foundation &     Next.js 15 + FastAPI, PostgreSQL, Alembic, Google
              Auth             OAuth PKCE, JWT cookies, landing page, /auth/me

  2           AudioEngine &    AudioEngine singleton with SSR guard, InnerTube
              InnerTube        stream URL fetch, sessionStorage cache 4h TTL,
                               basic play/pause/seek, error code 4 retry, rate
                               limit backoff

  3           Media Session +  Media Session API handler (lock screen controls),
              Gapless          gapless playback preloader, crossfade
                               implementation

  4           Search & Browse  Search page with useSearchParams(), ytmusicapi
                               integration, artist page, album page, skeleton
                               loaders

  5           Queue & Full     queueStore, all controls, mini player, now
              Player UI        playing panel, mobile fullscreen, queue panel,
                               prefetch next 3, autoplay toggle

  6           Home Feed +      Recommendations endpoint, home feed rows, mood
              Charts + New     cards, charts page, new releases page, horizontal
              Releases         scroll-snap

  7           Library, Likes,  All playlist CRUD, library page, liked songs,
              Playlists,       saved albums, followed artists, drag reorder,
              Follow           cover image upload, context menu

  8           Radio & Autoplay Song radio endpoint, artist radio endpoint,
                               autoplay on queue end, queue shows radio
                               suggestions

  9           Lyrics           LRCLIB integration, LRC parser, useLyrics hook,
                               LyricsView auto-scroll, tap-to-seek, plain text
                               fallback

  10          Sleep Timer &    Sleep timer UI + logic, crossfade implementation,
              Crossfade        user settings endpoints

  11          Collaborative    WebSocket hub for playlists, invite tokens,
              Playlists        real-time sync, optimistic UI with revert

  12          Jam              Jam WebSocket hub, JamSession UI, host/guest
                               controls, late-joiner sync, max 10 enforcement

  13          Blend            Blend algorithm, daily APScheduler cron,
                               invite/accept flow, match % UI, not-enough-data
                               state

  14          Downloads &      IndexedDB wrapper, download flow, offline
              Offline          playback, storage usage, bulk delete,
                               auto-cleanup

  15          Share Feature    Web Share API, copy link, shareable URLs for all
                               content types

  16          PWA & Polish     manifest.json, service worker via next-pwa,
                               install prompt, full responsive audit
                               (375/768/1024/1440), Lighthouse PWA \>= 90

  17          Serverless       Remove FastAPI entirely; Supabase Auth (Google)
              Migration ---    + Row-Level Security for likes/playlists/history;
              Supabase +       supabase-js data layer; Supabase Realtime replaces
              Vercel           the WebSocket hubs for Jam/Blend/chat; youtubei.js
                               stream resolution in Next route handlers (drop
                               yt-dlp); deploy on Vercel free tier. See §14.
  ----------- ---------------- -------------------------------------------------

**10. Critical Rules & Constraints**

**10.1 Audio Rules --- Non-Negotiable**

- **InnerTube API called from BROWSER ONLY. Never from FastAPI. Never.**

- **Audio bytes NEVER pass through FastAPI. Browser streams directly
  from YouTube CDN.**

- **HTMLAudioElement is the ONLY playback mechanism. No Howler.js. No
  Web Audio API. No exceptions.**

- **AudioEngine must check typeof window === \'undefined\' before ANY
  instantiation.**

- **ALWAYS pick opus/webm highest bitrate from adaptiveFormats. Never
  mp4/m4a unless opus unavailable.**

- **Stream URL TTL is 4 hours. Never play a cached URL older than 4
  hours --- always refetch.**

- **On error code 4: refetch InnerTube URL once. If still fails: toast +
  auto-skip after 2s.**

- **On InnerTube rate limit: silent exponential backoff 1s, 2s, 4s.
  Never show error to user.**

- **Media Session API must be updated on every song change.**

- **Gapless: preload next song 10 seconds before current ends.**

**10.2 Next.js 15 Rules**

- **searchParams must use useSearchParams() hook in client components.
  Never as a prop.**

- **Dynamic route params must be awaited in server components: const {
  id } = await params**

- **Use \'use client\' on any component using hooks, event handlers, or
  browser APIs.**

- **Never use useEffect for data fetching in server components.**

**10.3 Fetch & Network Rules**

- **ALL fetch calls wrapped in AbortController. Cancel on component
  unmount or new request.**

- **Never use axios --- native fetch only throughout the entire
  codebase.**

- **If any song stream fetch fails --- toast + auto-skip after 2s. Never
  stall the player.**

- **Prefetch next 3 stream URLs while current song plays --- fire and
  forget, never block UI.**

**10.4 Mobile Rules**

- **Every component works at 375px, 768px, 1024px, and 1440px+.**

- **Touch targets minimum 44x44px on all interactive elements.**

- **No hover-only interactions --- every hover state must have a tap
  equivalent.**

- **Bottom nav replaces sidebar at max-width 768px.**

**10.5 Security Rules**

- **JWT in httpOnly Secure SameSite=Strict cookie. Never localStorage.
  Never sessionStorage for auth.**

- **JWT expires after 100 days --- silently redirect to landing page on
  expiry, no toast, no modal.**

- **All FastAPI endpoints require auth except /auth/\* and GET
  /search.**

- **Jam join codes: 8-char random alphanumeric, regenerated per session,
  max 10 participants server-side.**

- **Playlist invite tokens expire after 7 days.**

- **FastAPI CORS allows frontend URL only --- NEVER wildcard \* in
  production.**

**10.6 Performance Rules**

- **Skeleton loaders on ALL async data --- never blank pages, never
  layout shifts.**

- **Use next/image with proper sizes prop for all album art and
  thumbnails.**

- **Horizontal feed rows use CSS scroll-snap for smooth swipe.**

- **Debounce all search inputs 300ms before firing request.**

- **Cross-device sync: queue, likes, playlists, recently played all sync
  via FastAPI.**

- **Virtualize lists over 50 items to avoid DOM bloat.**

**11. Environment Variables**

**Frontend (.env.local)**

  ------------------------------ ----------------------------------------
  **Variable**                   **Description**

  NEXT_PUBLIC_API_URL            FastAPI base URL e.g.
                                 https://api.yourdomain.com

  NEXT_PUBLIC_WS_URL             WebSocket base URL e.g.
                                 wss://api.yourdomain.com

  NEXT_PUBLIC_GOOGLE_CLIENT_ID   Google OAuth client ID
  ------------------------------ ----------------------------------------

**Backend (.env)**

  -------------------------- -------------------------------------------------
  **Variable**               **Description**

  DATABASE_URL               postgresql+asyncpg://user:pass@localhost/zha

  GOOGLE_CLIENT_ID           Google OAuth client ID

  GOOGLE_CLIENT_SECRET       Google OAuth client secret

  GOOGLE_REDIRECT_URI        https://api.yourdomain.com/auth/google/callback

  JWT_SECRET                 Random 64-char string for JWT signing

  JWT_EXPIRE_DAYS            100

  ORACLE_BUCKET_URL          Oracle Block Storage public base URL

  ORACLE_BUCKET_NAMESPACE    Oracle namespace

  ORACLE_BUCKET_NAME         zha-images

  FRONTEND_URL               https://yourdomain.com --- used for CORS
  -------------------------- -------------------------------------------------

**12. Error Handling**

  -------------------------- --------------------------------------------
  **Error Scenario**         **Behaviour**

  InnerTube stream URL fails Toast \'Song unavailable --- skipping\',
                             auto-skip after 2s

  HTMLAudioElement error     Refetch InnerTube URL once. If still fails,
  code 4                     skip.

  InnerTube rate limited     Silent exponential backoff: 1s, 2s, 4s. No
                             error shown.

  Stream URL 403/404         Pause, toast \'Track unavailable\',
  mid-play                   auto-skip after 2s

  Jam WebSocket disconnect   Reconnecting banner. Retry: 1s, 2s, 4s, up
                             to 30s.

  Jam WebSocket reconnect    Request jam:sync_state to resync position.

  Jam session full           Toast \'Session is full --- max 10 people\'.
                             Block join.

  Jam host leaves            Server sends jam:session_ended to all
                             guests. Show toast \'Jam session ended.\'

  LRCLIB no lyrics           Show \'Lyrics not available\'. No error
                             thrown.

  IndexedDB storage full     Modal \'Storage full --- delete some
                             downloads\'. Block new downloads.

  Google OAuth failure       Redirect to /?error=auth_failed with
                             message.

  API 401 Unauthorized       Clear auth state, redirect to landing page.

  JWT expired (100 days)     Silently redirect to landing page. No toast.
                             No modal.

  API 5xx Server Error       Toast \'Something went wrong\'. Log to
                             console. Do not crash app.

  Network offline            Offline banner at top. Allow playback of
                             downloaded songs only.

  Blend insufficient data    Show \'Not enough listening data yet ---
                             keep listening!\'

  Autoplay radio fails       Stop playback gracefully. Show toast
                             \'Nothing more to play.\'

  Sleep timer expires        Fade audio out over 3 seconds, then stop.
  -------------------------- --------------------------------------------

**13. Glossary**

  --------------------- -------------------------------------------------
  **Term**              **Definition**

  InnerTube             YouTube\'s internal API for fetching video/audio
                        stream URLs

  videoId               YouTube\'s 11-character video identifier e.g.
                        dQw4w9WgXcQ

  browseId              YouTube Music internal ID for artists and albums

  channelId             YouTube channel ID used for artists in ytmusicapi

  Stream URL            Signed CDN URL from InnerTube --- expires in \~6
                        hours

  LRC                   Lyric file format with timestamps: \[mm:ss.xx\]
                        Lyric line

  IndexedDB             Browser key-value database for downloaded audio

  Blob URL              Browser-internal URL from binary data for offline
                        playback

  PKCE                  Proof Key for Code Exchange --- OAuth 2.0
                        extension for public clients

  Jam                   Shared real-time listening session, host
                        controls, guests queue, max 10

  Blend                 Shared playlist from two users listening
                        histories, daily refresh

  Radio                 Auto-generated endless playlist based on a seed
                        song or artist

  Autoplay              Feature that starts radio when queue ends ---
                        keeps music playing forever

  Gapless Playback      No silence between songs --- next song preloaded
                        and swapped instantly

  Crossfade             Smooth audio transition between songs --- current
                        fades out as next fades in

  Sleep Timer           Stops playback after a set time or end of current
                        song

  Media Session API     Browser API that connects app to OS media
                        controls and lock screen

  SSR Guard             if (typeof window === \'undefined\') return ---
                        prevents server-side crashes

  AbortController       Browser API for cancelling in-flight fetch
                        requests

  PWA                   Progressive Web App --- installable via browser,
                        works offline

  ytmusicapi            Python library for YouTube Music metadata,
                        search, and radio

  LRCLIB                Free public API for synced and plain text lyrics

  opus/webm             Preferred audio format from InnerTube --- best
                        quality to size ratio

  Optimistic UI         Apply change instantly in UI, revert silently if
                        server returns error

  Cosine Similarity     Math used in Blend to measure how similar two
                        users\' tastes are
  --------------------- -------------------------------------------------

---

**14. Phase 17 --- Serverless Migration (FastAPI → Supabase + Vercel)**

**Status:** Planned. Added 2026-06. Supersedes the FastAPI/VPS backend
described in §2.2, §3.5, and §7. Sections 1--13 remain accurate except where
this section overrides them.

**14.1 Goal**

Remove the FastAPI backend and run ഴ-zha as a Next.js app on Vercel's free
tier, with Supabase (free tier) providing auth, database, and realtime.

- No VPS. No card required for deployment. Free forever (within free-tier
  limits, see §14.10).
- Same or faster playback.
- All existing features preserved: Jam, chat, collaborative playlists, liked
  songs, listening history, Blend, downloads, PWA.

**14.2 Architecture --- Before → After**

  ------------------------ ----------------------------- ------------------------------------
  **Concern**              **Before (v3 / FastAPI)**     **After (Phase 17)**

  Auth                     FastAPI Google OAuth + JWT     Supabase Auth (Google provider);
                           cookie; custom users table     session held by supabase-js in the
                                                          browser; auth.users is the identity

  Data (likes,             FastAPI + SQLAlchemy →         Browser → supabase-js → Postgres,
  playlists, history)      Postgres                       guarded by Row-Level Security

  Realtime (Jam,           FastAPI native WebSocket hubs   Supabase Realtime: Broadcast +
  collab playlist, chat)                                  Presence for live sync; a messages
                                                          table + Realtime subscription for
                                                          chat

  YouTube metadata /       Next.js route handlers +       UNCHANGED (runs as Vercel
  search / browse          youtubei.js                    serverless/edge functions)

  Audio stream             FastAPI yt-dlp resolver        Next.js route handler +
  resolution                                              youtubei.js (drop yt-dlp)

  Audio playback           HTMLAudioElement; browser      UNCHANGED
                           streams from CDN

  Downloads / offline      IndexedDB                      UNCHANGED

  PWA                      Serwist                        UNCHANGED

  Hosting                  VPS (FastAPI) + Supabase        Vercel (Next.js) + Supabase
                           Postgres                        (Auth + DB + Realtime)
  ------------------------ ----------------------------- ------------------------------------

**14.3 Locked Decisions**

- **youtubei.js placement:** stays in Next.js Route Handlers (Vercel
  functions), NOT true browser-direct. YouTube's InnerTube API and
  googlevideo CDN do not send permissive CORS headers, so a browser cannot
  call them cross-origin without a proxy; the Vercel function IS that proxy.
  This still satisfies "no VPS / no card / free."

- **Stream resolution:** consolidate on youtubei.js and remove the Python
  yt-dlp resolver. Gated on a playback spike (§14.5, Slice 4) before yt-dlp
  is deleted.

- **Existing data:** migrate --- preserve users, playlists, likes, and
  history by mapping the old FastAPI user identities onto Supabase auth.users
  (§14.6). No fresh start.

This overrides §10.1's "InnerTube called from BROWSER ONLY / never from a
server": metadata and stream resolution run in Vercel functions (not a VPS),
while audio bytes still never pass through any server --- the browser streams
directly from the CDN, which is the spirit of that rule.

**14.4 Prerequisites (one-time, done in dashboards --- not code)**

1. **Supabase project** --- you already have one (it backs the current
   DATABASE_URL). Collect from Dashboard → Project Settings → API:
   - NEXT_PUBLIC_SUPABASE_URL (the project URL)
   - the anon / publishable key (public --- safe in the browser)
   - the service-role key (admin --- local/CI only, never in the bundle, never
     committed; lives in gitignored env files)
2. **Google provider** --- Dashboard → Authentication → Providers → Google:
   paste the existing Google client ID + secret; in Google Cloud Console add
   the Supabase callback `https://<ref>.supabase.co/auth/v1/callback` to the
   OAuth client's Authorized redirect URIs.
3. **Auth URL config** --- add Site URL + redirect allow-list:
   `http://localhost:3000`, and later the Vercel domain.
4. **Realtime** --- enable Realtime on the tables used for chat/collab.

**14.5 Implementation Slices** (each independently shippable; app stays
runnable in dev after every slice)

- **Slice 0 --- Scaffolding (DONE in this change).** Add
  @supabase/supabase-js; create frontend/lib/supabase/client.ts (lazy browser
  singleton; throws only when used unconfigured); document env vars in
  .env.example. Non-breaking --- nothing imports the client yet.

- **Slice 1 --- Auth → Supabase Auth.**
  - Replace the sign-in buttons (currently hard-coded to
    `http://localhost:8000/auth/google` in Navbar.tsx / Sidebar.tsx) with
    `supabase.auth.signInWithOAuth({ provider: 'google' })`.
  - Replace userStore.checkSession / the /auth/me cookie check with
    `supabase.auth.getSession()` + `onAuthStateChange`.
  - Remove the FastAPI auth router and JWT/deps from the request path.
  - **This also fixes mobile sign-in** (the old flow was hard-coded to
    localhost; Supabase handles redirects per-origin). Closes the
    long-standing mobile-auth gap.

- **Slice 2 --- Data → supabase-js + RLS.**
  - Author RLS policies (§14.7) on playlists, playlist_songs,
    playlist_collaborators, liked_* , play_history, followed_artists, user
    settings, and the invite-token / message tables. RLS becomes the ONLY
    server-side authorization, so this is security-critical and reviewed.
  - Rewrite the frontend data layer (lib/stores/playlistStore.ts,
    userDataService.ts, library pages) from apiClient(FastAPI) → supabase-js
    queries. Keep the existing optimistic-UI behavior.
  - Remove the FastAPI playlist/library/users/blend routers.

- **Slice 3 --- Realtime → Supabase Realtime.**
  - Replace the FastAPI WebSocket hubs (lib/services/jamSocket.ts,
    playlistSocket.ts; backend jam/playlist_ws) with Supabase Realtime
    channels: Broadcast for play/pause/seek/queue events, Presence for who's
    online and the host/guest roster, and a messages table + Realtime
    subscription for chat (§14.8).
  - Re-implement host authority, late-joiner sync, the host-drop grace
    window, and max-10 enforcement on Realtime primitives.

- **Slice 4 --- Stream resolution.**
  - Spike: confirm youtubei.js reliably returns a playable audio URL
    (including PoToken handling) for a representative set of tracks via
    /api/innertube/stream|pipe. Verify start-of-playback latency is ≤ the
    current yt-dlp path.
  - On success, route all playback through the youtubei.js Next handler and
    delete the FastAPI audio.py / yt-dlp dependency.

- **Slice 5 --- Remove FastAPI + Deploy.**
  - Delete backend/ once nothing references it. Drop NEXT_PUBLIC_API_URL and
    the host:8000 resolution in lib/api/client.ts.
  - Vercel: import the GitHub repo, set the build to the frontend/ project,
    add env vars (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
    any YouTube/PoToken config). First deploy → smoke test → set the Vercel
    domain in Supabase Auth redirect allow-list + Google OAuth.

**14.6 Data Migration Plan**

- The current schema already lives in the Supabase Postgres instance; tables
  are largely reused. The break is identity: the FastAPI users table (own
  UUIDs keyed to google_id) → Supabase auth.users (its own UUIDs).
- Map each existing user to an auth.users row by email/google_id; build a
  users.id → auth.users.id mapping table.
- Re-point foreign keys (playlists.owner_id, likes.user_id,
  play_history.user_id, collaborators, etc.) to the auth.users id via the
  mapping, inside one transactional migration. Keep the old users table until
  verification passes, then drop it.
- Run as a one-off SQL migration using the service-role key (admin), never
  from the browser.

**14.7 Row-Level Security (representative policies)**

- Enable RLS on every user-data table; default-deny.
- Ownership read/write: `auth.uid() = owner_id` (playlists, settings),
  `auth.uid() = user_id` (likes, history, followed artists).
- Child rows via parent: playlist_songs / messages readable & writable when
  the user owns the parent playlist OR is a collaborator (subquery against
  playlist_collaborators), and the playlist is collaborative for writes.
- Invite/join: a token-scoped policy lets a non-owner insert themselves as a
  collaborator when presenting a valid, unexpired invite token.
- Public/none: search/stream stay in Vercel functions, never touch these
  tables, so no RLS needed there.

**14.8 Realtime Design (Jam / collab / chat)**

- One Realtime channel per session (`jam:{sessionId}` /
  `playlist:{playlistId}`).
- **Broadcast** carries ephemeral control events: play, pause, seek, track
  change, queue add/reorder. Host is authoritative; guests apply host events
  and send requests the host echoes.
- **Presence** tracks the live roster (host + guests), drives the "N
  listening" UI, enforces max-10, and detects host drop → start the existing
  grace window before ending for everyone.
- **Chat** persists to a messages table (so history survives reload) and
  streams new rows via a Realtime postgres-changes subscription; RLS limits
  it to session participants.
- Late-joiner sync: on join, request current state from the host over
  Broadcast (or read the last persisted playback row).

**14.9 Environment Variables (Phase 17)**

  ------------------------------- ------------------------------------------------
  **Variable**                    **Purpose**

  NEXT_PUBLIC_SUPABASE_URL        Supabase project URL (public)

  NEXT_PUBLIC_SUPABASE_ANON_KEY   Anon/publishable key (public; RLS enforces
                                  access)

  SUPABASE_SERVICE_ROLE_KEY       Admin key for migrations/admin scripts ---
                                  local/CI only, never in the client bundle,
                                  never committed

  (YouTube/PoToken config)        As needed by youtubei.js stream resolution in
                                  the Vercel function
  ------------------------------- ------------------------------------------------

NEXT_PUBLIC_API_URL and the backend's own .env are removed at Slice 5.

**14.10 Free-Tier Caveats & Risks (documented, not hand-waved)**

- **Supabase free projects pause after ~7 days of inactivity** --- must be
  reopened (a periodic keep-alive ping or just regular use avoids it).
- **Vercel Hobby** is non-commercial and has function execution / bandwidth
  limits --- fine for a private app.
- **Realtime free tier:** ~200 concurrent connections, ~2M messages/month ---
  ample for personal Jam use.
- **youtubei.js fragility:** YouTube changes break it periodically; in the
  serverless model a fix ships via redeploy (and the PWA update cycle) rather
  than a server hotfix.
- **"Same or faster" is a target, not a guarantee:** youtubei.js stays in
  Vercel functions (no extra browser bundle weight), and spreading metadata
  requests across users' IPs avoids single-server-IP rate-limiting --- a
  genuine win --- but start-up latency should be measured in Slice 4.

**14.11 Done Criteria**

- Sign in with Google works on desktop AND mobile via Supabase Auth.
- Likes, playlists (incl. collaborative), and history read/write through
  supabase-js with RLS; no FastAPI in any request path.
- Jam + collaborative playlist + chat work over Supabase Realtime with host
  authority and presence.
- Playback works with youtubei.js-only stream resolution at ≤ current latency.
- backend/ deleted; app deployed on Vercel free tier from GitHub; no card
  required.
