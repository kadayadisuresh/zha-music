# Phase 4: Search & Browse - Research

**Researched:** 2026-05-26
**Domain:** YouTube Music Search, Suggestions, and Content Browsing
**Confidence:** HIGH

## Summary

This phase focuses on the "Discovery" aspect of the application, leveraging `youtubei.js` to perform unified searches across YouTube Music and providing detailed browsing pages for Artists and Albums. Research confirms that `youtubei.js` provides a robust `music` client that handles category-specific searches, autocomplete suggestions, and deep-link retrieval for artist discographies and album tracklists.

The primary recommendation is to centralize all InnerTube interactions within Next.js **Route Handlers** (Server-side) to maintain session stability (specifically for PO token management) and to provide a clean, typed API for the frontend components.

**Primary recommendation:** Use `yt.music.search()` for unified results and `yt.music.getSearchSuggestions()` for autocomplete, mapping complex InnerTube nodes to simplified frontend interfaces in the server layer.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SEARCH-01 | Unified search page (songs, artists, albums, playlists) via ytmusicapi. | `youtubei.js` `music.search()` provides categorized shelves for these types. |
| SEARCH-02 | Artist and Album detail pages. | `music.getArtist()` and `music.getAlbum()` return structured discography and tracklists. |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Search Logic | Frontend Server | — | Keeps InnerTube session logic on the server; facilitates result caching and PO token usage. |
| Search UI | Browser | — | Handles user input, debounce for suggestions, and client-side navigation. |
| Content Mapping | Frontend Server | — | Normalizes complex `youtubei.js` nodes into stable frontend interfaces before delivery to client. |
| Image Serving | Browser (Direct) | Frontend Server (Proxy) | Use direct URLs via `next/image` with domain allowlist; proxy only if CORS blocks color extraction. |
| Browsing Pages | Frontend Server | — | Server Components provide the best SEO and fast initial load for data-heavy detail pages. |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| youtubei.js | 17.0.1 | YouTube InnerTube Client | Full support for Music-specific endpoints and Protobuf parsing. [VERIFIED: npm registry] |
| youtube-po-token-generator | 0.6.0 | PO Token Generation | Essential for bypassing bot detection on modern InnerTube requests. [VERIFIED: package.json] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|--------------|
| lodash.debounce | 4.0.8 | Input Debouncing | Prevent API flooding during search typing. |
| use-debounce | 10.0.x | React Debounce Hook | Alternative for clean React-friendly debouncing. |

## Architecture Patterns

### Recommended Project Structure
```
frontend/
├── app/
│   ├── api/
│   │   ├── search/
│   │   │   ├── route.ts         # Unified search results
│   │   │   └── suggestions/
│   │   │       └── route.ts     # Autocomplete suggestions
│   │   └── browse/
│   │       ├── artist/[id]/     # Artist details proxy
│   │       └── album/[id]/      # Album details proxy
├── lib/
│   ├── api/
│   │   └── mappers.ts           # Functions to transform YT nodes to UI types
│   └── innertube/
│       └── session.ts           # Singleton session provider (Already exists)
```

### Pattern 1: Unified Search Mapping
InnerTube search results return "Shelves" (e.g., MusicShelf). We should map these to a standard response format.

```typescript
// Example Mapping in Route Handler
const results = await yt.music.search(query);
const response = {
  topResult: results.contents?.[0], // Usually the most relevant item
  songs: results.songs?.contents.map(mapToTrack) || [],
  albums: results.albums?.contents.map(mapToAlbum) || [],
  artists: results.artists?.contents.map(mapToArtist) || [],
};
```

### Anti-Patterns to Avoid
- **Raw Node Passing:** Sending `MusicResponsiveListItem` directly to the client. This exposes internal API complexity and breaks the UI if `youtubei.js` updates its parser.
- **Unchecked Thumbnails:** Hardcoding thumbnail array index `[0]`. YT often provides a low-res thumbnail first; always sort or pick a specific resolution.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Protobuf Parsing | Custom Fetch | `youtubei.js` | InnerTube uses complex protobuf/JSON structures that are hard to maintain manually. |
| Search Debouncing | `setTimeout` | `lodash.debounce` | Handles edge cases like component unmounting and racing. |
| Token Management | Custom Refresh Logic | `session.ts` (Existing) | The project already has a PO token refresh mechanism; reuse it. |

## Common Pitfalls

### Pitfall 1: Race Conditions in Autocomplete
**What goes wrong:** User types "Abba", the "A" request finishes after the "Abba" request, showing wrong suggestions.
**How to avoid:** Use `AbortController` in the client-side fetch or a robust debouncing strategy.

### Pitfall 2: CORS on Thumbnails
**What goes wrong:** `googleusercontent.com` images might fail to load if used in a `<canvas>` for color extraction.
**How to avoid:** Use `next/image` for standard display; implement an image proxy route if color extraction is needed.

### Pitfall 3: Artist Section Variability
**What goes wrong:** Some artists have "Singles", others have "Albums", others have "Videos".
**How to avoid:** Generic shelf rendering in the Artist page that iterates over `sections` rather than expecting specific ones.

## Code Examples

### Search Suggestions (Route Handler)
```typescript
// Source: [VERIFIED: youtubei.js docs]
const yt = await getInnertube();
const suggestions = await yt.music.getSearchSuggestions(query);
const flat = suggestions.flatMap(section => 
  section.contents.map(item => item.text)
);
```

### Mapping a Song
```typescript
function mapToTrack(item: MusicResponsiveListItem) {
  return {
    id: item.id,
    title: item.title,
    artist: item.artists?.map(a => a.name).join(', ') || 'Unknown',
    cover: item.thumbnails.sort((a,b) => b.width - a.width)[0]?.url,
    duration: item.duration?.seconds,
    album: item.album?.name
  };
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `ytmusicapi` | `youtubei.js` | 2024 | Better TS support, native in Node.js, no Python dependency. |
| Public API | InnerTube (Private) | Always | Access to features not in public Data API (Suggestions, Radio, Library). |

## Gray Area Decisions (GADs)

| Decision | Research Finding | Recommendation |
|----------|------------------|----------------|
| **Search Filtering** | `youtubei.js` supports `{ type: 'song' | 'album' | 'artist' }`. | Use a unified view for the initial search; provide "View All" links that switch to filtered tabs. |
| **Search Location** | InnerTube sessions are best managed on the server. | **Server-side (Route Handlers)** for all data fetching. |
| **Image Proxying** | `i.ytimg.com` is generally CORS-friendly; `lh3.googleusercontent.com` is hit-or-miss. | Configure `next.config.ts` domains first; add proxy route only if color extraction is required. |

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | youtubei.js | ✓ | 24.13.0 | — |
| npm | Dependency Install | ✓ | 11.1.0 | — |

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (Recommended) |
| Quick run command | `npm run test:unit` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SEARCH-01 | Unified search returns mapped data | Integration | `vitest tests/api/search.test.ts` | ❌ Wave 0 |
| SEARCH-02 | Artist/Album details return tracks | Integration | `vitest tests/api/browse.test.ts` | ❌ Wave 0 |

## Sources

### Primary (HIGH confidence)
- `/luanrt/youtube.js` (Context7) - Music Search, Suggestions, getArtist, getAlbum documentation.
- `youtubei.js` Official GitHub - Source code and Type definitions.

### Secondary (MEDIUM confidence)
- Next.js Documentation - Image optimization and Route Handlers.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Library is already in project and up to date.
- Architecture: HIGH - Next.js Route Handlers are standard for this pattern.
- Pitfalls: MEDIUM - Real-world CORS/Racing issues vary by network/environment.

**Research date:** 2026-05-26
**Valid until:** 2026-06-25
