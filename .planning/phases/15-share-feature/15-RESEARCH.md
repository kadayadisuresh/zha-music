# Phase 15: Share Feature - Research

**Researched:** 2026-05-27
**Domain:** Routing, Metadata, Web APIs (Client-side)
**Confidence:** HIGH

## Summary

The Share Feature aims to make all primary content types (songs, albums, artists, playlists) easily shareable through native OS sharing mechanics or clipboard fallback. It leverages Next.js 15 App Router `generateMetadata` for dynamic Open Graph tags, ensuring that shared URLs generate rich previews on platforms like WhatsApp and Twitter. 

**Primary recommendation:** Use "invisible" redirect routing for `/song/[id]` and use existing YouTube thumbnails for OG images rather than dynamically generating them, ensuring the fastest performance and simplest architecture. Implement sharing via `navigator.share()` with a fallback to `navigator.clipboard.writeText()` natively available in the browser.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| URL Structure / Routing | Browser / Client | Frontend Server (SSR) | Next.js App Router handles dynamic routes (`/song/[id]`, `/album/[id]`) and redirects to playback. |
| Open Graph Meta Tags | Frontend Server (SSR) | — | Next.js `generateMetadata` runs on the server to populate `<head>` tags for web crawlers before client hydration. |
| Web Share API & Copy Link | Browser / Client | — | `navigator.share()` and `navigator.clipboard.writeText()` are exclusively client-side web APIs. |
| Deep Linking post-login | Frontend Server (SSR) | API / Backend | Auth flow redirects need an HTTP-only cookie or state param to preserve the intended destination. |
| Share Placements (UI) | Browser / Client | — | Context menus and headers are rendered React UI components. |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `next/navigation` | 16.x / App Router | Routing & Redirects | Next.js standard for App Router navigation and metadata generation. |
| `navigator.share` | Native | Web Share API | Built-in browser standard for triggering native mobile/desktop share sheets. |
| `navigator.clipboard` | Native | Fallback Share | Built-in browser standard for clipboard access when Share API is unsupported. |
| `lucide-react` | ^1.16.0 | Icons | Already in project dependencies; standard for `Share` and `Copy` icons. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Next.js `generateMetadata` | `react-helmet` | App Router enforces `generateMetadata` for Server Components, rendering `react-helmet` obsolete. |
| Existing Thumbnails | `@vercel/og` | Generating custom image cards via `@vercel/og` adds build overhead, API edge dependencies, and complexity. Existing YouTube thumbnails are already optimized. |

## Architecture Patterns

### Pattern 1: Metadata + Client Redirector for Songs
**What:** Combining server-side Open Graph metadata generation with a client-side component that forces immediate playback and redirects the user to the main layout.
**When to use:** When accessing `/song/[id]` directly. Since the application is SPA-like with a persistent bottom player, there is no standalone visual "song page".
**Example:**
```tsx
// app/song/[id]/page.tsx
import { Metadata } from 'next';
import ClientPlayerRedirect from './ClientPlayerRedirect';
// ... fetch metadata ...
export async function generateMetadata({ params }): Promise<Metadata> {
  const songInfo = await fetchSongInfo(params.id);
  return {
    title: `${songInfo.title} by ${songInfo.artist}`,
    openGraph: {
      images: [songInfo.thumbnailUrl],
    }
  };
}

export default function SongPage({ params }) {
  return <ClientPlayerRedirect videoId={params.id} />;
}
```

### Pattern 2: Unified Share Handler
**What:** A helper utility that detects platform support and degrades gracefully.
**Example:**
```typescript
export async function handleShare(title: string, text: string, url: string) {
  if (navigator.share && /mobile|android|iphone/i.test(navigator.userAgent)) {
    try {
      await navigator.share({ title, text, url });
    } catch (error) {
      // User cancelled or failed
    }
  } else {
    await navigator.clipboard.writeText(url);
    // Dispatch toast notification "Link copied to clipboard"
  }
}
```

### Anti-Patterns to Avoid
- **Anti-pattern:** Generating costly dynamic images via `@vercel/og` when high-quality standard artwork (YouTube thumbnails) is already available natively.
- **Anti-pattern:** Rendering full React trees on the server for `/song/[id]` when it just needs to trigger `usePlayerStore` and replace the route.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Open Graph Tags | Custom Document overrides or `<head>` parsing | Next.js `generateMetadata` | Built natively into the App Router for optimal SEO/OG injection without client overhead. |
| Custom Share Sheets | Custom modals mimicking OS share sheets | `navigator.share()` | The native OS share sheet provides direct integration with WhatsApp, Messages, Twitter, etc., which a web UI cannot match. |

## Common Pitfalls

### Pitfall 1: Post-Login Destination Loss
**What goes wrong:** A user clicks a share link (e.g., to join a Collaborative Playlist or view an Album), gets prompted to log in via Google OAuth, and upon returning, is dumped onto the `/` (Home) page instead of the shared link.
**Why it happens:** The `/api/auth/google` route hardcodes the callback destination to `settings.FRONTEND_URL` without persisting the original intended route.
**How to avoid:** Pass a `return_to` query parameter to `/api/auth/google`. Have the backend save it in an HTTP-only cookie alongside `oauth_state`, and read it in `/google/callback` to redirect dynamically.

### Pitfall 2: Desktop `navigator.share` Limitations
**What goes wrong:** Calling `navigator.share()` on desktop browsers (like Chrome on Windows) can sometimes trigger clunky or unhelpful UI, or silently fail if not in a secure context (HTTPS).
**Why it happens:** Web Share API was primarily designed for mobile OS integration.
**How to avoid:** Detect mobile user agents or enforce the clipboard fallback explicitly for non-mobile environments, OR present a custom "Share Link Copied" popover on desktop.

### Pitfall 3: Next.js SSR Audio Failures
**What goes wrong:** Trying to initialize `usePlayerStore` or Innertube directly in `page.tsx` for `/song/[id]`.
**Why it happens:** Audio Context and Zustand persistent stores are client-only.
**How to avoid:** Ensure the redirector component is strictly marked `"use client"` and that store dispatches happen inside `useEffect`.

## Gray Area Decisions (GADs) Log

| # | Topic | Recommendation | Risk if Wrong |
|---|-------|----------------|---------------|
| 1 | **OG Image Generation** | Use **existing YouTube thumbnails** via the Innertube API. Do not use `@vercel/og`. | None. Thumbnails are standard. Using `@vercel/og` would add unnecessary complexity. |
| 2 | **`/song/[id]` Routing** | Render an **"invisible" page** that only generates OG tags on the server, then a `<ClientRedirector>` component that dispatches `playTrack` and redirects to `/`. | The alternative (building a full standalone song UI) violates the persistent-player architectural paradigm. |
| 3 | **Deep Linking Post-Login** | Modify `backend/app/api/auth.py` to accept a `return_to` param. Store it in a temporary cookie before OAuth, read it in the callback, and redirect there instead of the home page. | Users will lose context when clicking shared links that require auth. |

## Code Examples

### Modifying Backend for `return_to` Redirects
```python
# In backend/app/api/auth.py
@router.get("/google")
async def login_google(return_to: str = "/"):
    # ...
    redirect_response.set_cookie(
        key="return_to_url",
        value=return_to,
        httponly=True,
        secure=True,
        samesite="lax",
        max_age=600
    )
    return redirect_response

@router.get("/google/callback")
async def google_callback(request: Request, ...):
    # ...
    return_to = request.cookies.get("return_to_url") or settings.FRONTEND_URL
    response = RedirectResponse(url=return_to)
    response.delete_cookie("return_to_url")
    # ...
```

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Web Share API | Mobile Share | ✓ | Native | `navigator.clipboard` |
| `lucide-react` | Icons | ✓ | ^1.16.0 | — |

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Next.js Native / Jest (Assuming Standard) |
| Config file | `jest.config.js` or `vitest.config.ts` |
| Quick run command | `npm run test` |
| Full suite command | `npm run test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| REQ-SH-01 | Generates valid OG tags for song/album/playlist | unit | `npm run test:metadata` | ❌ Wave 0 |
| REQ-SH-02 | Web Share API triggered on mobile | unit | `npm run test:share` | ❌ Wave 0 |
| REQ-SH-03 | Clipboard copy triggered on desktop fallback | unit | `npm run test:share` | ❌ Wave 0 |
| REQ-SH-04 | Redirect logic functions cleanly on `/song/[id]` | e2e | `npx playwright test share.spec.ts` | ❌ Wave 0 |

## Sources

### Primary (HIGH confidence)
- MDN Web Docs - Web Share API: Verified `navigator.share()` mechanics and platform support.
- Next.js Documentation - `generateMetadata`: Verified server-side App Router OG tag implementation.

### Secondary (MEDIUM confidence)
- Codebase audit: Verified `frontend/package.json` for Next.js App Router usage and `lucide-react`. Verified `backend/app/api/auth.py` for OAuth flow.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Next.js App Router mechanics and standard browser APIs.
- Architecture: HIGH - Invisible redirect routing is a common standard for Spotify-like SPA applications.
- Pitfalls: HIGH - Auth flow limitations identified directly in `backend/app/api/auth.py`.

**Research date:** 2026-05-27
**Valid until:** 2026-06-27