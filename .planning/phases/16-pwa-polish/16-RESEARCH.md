# Phase 16: PWA & Polish - Research

**Researched:** 2026-05-27
**Domain:** PWA, Web Performance, Accessibility (A11y), Responsive Design
**Confidence:** HIGH

## Summary

This phase focuses on transforming the web application into a high-quality Progressive Web App (PWA) with a focus on installability, offline resilience, and polished user experience across all devices. We will transition from a standard Next.js site to a PWA using **Serwist** (the modern successor to `next-pwa`), leverage Next.js 15/16's native metadata and manifest support, and implement advanced caching strategies to ensure performance targets are met.

**Primary recommendation:** Use `@serwist/next` for Service Worker management and Next.js's native `app/manifest.ts` for manifest generation. Implement a non-intrusive background update strategy to avoid interrupting audio playback.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| PWA Manifest | Frontend Server | — | Generated dynamically via `manifest.ts` |
| Service Worker | Browser (Worker) | — | Runs in background to intercept requests and manage cache |
| Install Prompt | Browser (Client) | — | Handled via `beforeinstallprompt` event logic |
| Offline Fallback | Browser (Worker) | Frontend Server | Served from cache by SW when network is unavailable |
| Caching Logic | Browser (Worker) | — | Defined in SW source (`sw.ts`) |
| Perf Audits | Build / CI | — | Lighthouse/LHC used to verify targets during build |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @serwist/next | ^9.0.0 | Next.js PWA integration | Modern successor to next-pwa, better support for App Router and Turbopack [VERIFIED: npm] |
| serwist | ^9.0.0 | Core Service Worker library | Fork of Workbox designed for modern ESM/TS environments [VERIFIED: serwist.pages.dev] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|--------------|
| ExpirationPlugin | (part of serwist) | Cache TTL management | For Search/Artist results to prevent stale data bloat |
| next-themes | ^0.4.4 | Dark/Light mode | Essential for PWA theme color consistency |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Serwist | next-pwa (shadowwalker) | next-pwa is less actively maintained and has issues with Next.js 15+ Turbopack |
| Serwist | Custom Workbox | More manual boilerplate; Serwist provides cleaner Next.js integration |

**Installation:**
```bash
npm install @serwist/next serwist
```

## Architecture Patterns

### Recommended Project Structure
```
frontend/
├── app/
│   ├── manifest.ts     # PWA Manifest (Next.js native)
│   ├── sw.ts           # Service Worker Source (compiled to public/sw.js)
│   └── ~offline/
│       └── page.tsx    # Offline Fallback Page
├── components/
│   └── pwa/
│       ├── InstallPrompt.tsx # Custom logic for install invitation
│       └── PWAProvider.tsx   # Client component to manage SW lifecycle
└── next.config.ts      # Wrapped with withSerwistInit
```

### Pattern 1: Native Manifest (manifest.ts)
**What:** Use Next.js 15/16's file-based metadata to generate the manifest.
**Why:** Better integration with the build system and dynamic values (e.g., localized descriptions).
**Example:**
```typescript
// app/manifest.ts
import { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'ZHA Better',
    short_name: 'ZHA',
    description: 'A better YouTube Music client',
    start_url: '/',
    display: 'standalone',
    background_color: '#000000',
    theme_color: '#000000',
    icons: [
      {
        src: '/icons/icon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/maskable-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  }
}
```

### Pattern 2: Runtime Caching with TTL
**What:** Use `ExpirationPlugin` to limit the age of API responses.
**When to use:** For Search and Artist detail pages where data changes but can be cached for some time.
**Example:**
```typescript
// sw.ts
import { defaultCache } from "@serwist/next/browser";
import { installSerwist, NetworkFirst, ExpirationPlugin } from "serwist";

installSerwist({
  // ... precache manifest
  runtimeCaching: [
    ...defaultCache,
    {
      matcher: ({ url }) => url.pathname.startsWith("/api/search") || url.pathname.startsWith("/api/artist"),
      handler: new NetworkFirst({
        cacheName: "api-data",
        plugins: [
          new ExpirationPlugin({
            maxAgeSeconds: 24 * 60 * 60, // 24 hours
            maxEntries: 100,
          }),
        ],
      }),
    },
  ],
});
```

### Anti-Patterns to Avoid
- **Hard-Reload on Update:** Forcing a page reload when the Service Worker updates can cut off active audio playback. Use background updates or non-blocking toasts.
- **Caching Audio Streams:** Service Workers should generally *exclude* audio stream chunks from standard caching (they are large and handled by the AudioEngine/IndexedDB). Use `matcher` to exclude `/api/proxy/audio`.
- **Large Precaching:** Only precache essential shell assets (HTML, main JS, CSS, critical icons). Don't precache entire libraries or all routes.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SW Generation | Custom Webpack/Build scripts | Serwist / next-pwa | Handles manifest injection and cross-browser quirks automatically. |
| Cache Expiration | Manual IndexedDB cleanup | ExpirationPlugin | Standardized, battle-tested logic for Workbox-based SWs. |
| Maskable Icons | Manual cropping in code | Graphics editor (Figma/Squoosh) | Needs to be done at the asset level to ensure 80% safe zone compliance. |

## Common Pitfalls

### Pitfall 1: Service Worker in Development
**What goes wrong:** Developers see cached versions of their code, making debugging impossible.
**How to avoid:** Always set `disable: process.env.NODE_ENV === 'development'` in `next.config.ts`.

### Pitfall 2: Maskable Icon "Safe Zone"
**What goes wrong:** Android crops important parts of the icon if they extend into the padding area.
**How to avoid:** Ensure all visual elements of the maskable icon are within the center 80% circle (radius 40% of width). [CITED: web.dev/maskable-icon]

### Pitfall 3: Broken Offline Fallback
**What goes wrong:** The fallback page itself depends on non-precached assets (e.g., an external image or a specific JS chunk).
**How to avoid:** Ensure the `/~offline` route is minimal and its critical CSS/JS is part of the precache manifest.

## Code Examples

### Custom Install Prompt Logic
```typescript
// components/pwa/InstallPrompt.tsx
'use client'
import { useEffect, useState } from 'react'

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [showPrompt, setShowPrompt] = useState(false)

  useEffect(() => {
    const handleBeforeInstall = (e: any) => {
      e.preventDefault()
      setDeferredPrompt(e)
      
      // 2-minute delay requirement
      const isDismissed = localStorage.getItem('pwa_prompt_dismissed')
      if (!isDismissed) {
        setTimeout(() => setShowPrompt(true), 120000)
      }
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstall)
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall)
  }, [])

  const handleInstall = async () => {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') setDeferredPrompt(null)
    setShowPrompt(false)
  }

  const handleDismiss = () => {
    setShowPrompt(false)
    localStorage.setItem('pwa_prompt_dismissed', 'true') // Persistence
  }

  if (!showPrompt) return null
  return (
    <div className="fixed bottom-20 right-4 p-4 bg-zinc-900 border border-zinc-800 rounded-lg shadow-xl z-50">
      <p className="text-sm mb-2">Install ZHA for a better experience</p>
      <div className="flex gap-2">
        <button onClick={handleInstall} className="px-3 py-1 bg-white text-black text-xs font-bold rounded">Install</button>
        <button onClick={handleDismiss} className="px-3 py-1 text-zinc-400 text-xs">Maybe later</button>
      </div>
    </div>
  )
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| next-pwa | Serwist | 2024 | Better ESM support, Next.js 15 compatibility |
| manifest.json in public | app/manifest.ts | Next.js 13.4+ | Dynamic manifest generation, better build integration |
| Static Viewport tags | export const viewport | Next.js 14 | Improved performance and configuration for mobile devices |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Serwist is stable for Next.js 16 | Standard Stack | Medium - Serwist is very active but Next.js 16 is cutting edge. |
| A2 | Custom prompt persistence is 1-time | Code Examples | Low - User might want it to reappear after X days. |

## Open Questions

1. **How to handle Service Worker updates during playback?**
   - Recommendation: Use `skipWaiting: false` and allow the user to continue their session. The new SW will activate on the next reload. If a critical bug needs fixing, we can use a "Update available" toast.
2. **Offline Fallback Content for Audio?**
   - Recommendation: If the user is offline, the search/browse pages should show the fallback. However, the "Library" or "Downloads" section should still work using IndexedDB data (from Phase 14). We should avoid showing the full-page fallback if the user is in the Downloads section.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Next.js 16 | ✓ | 24.13.0 | — |
| npm | Package management | ✓ | 11.6.2 | — |
| Lighthouse | Performance Audits | ✗ | — | Use browser DevTools (manual) |

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest + Playwright |
| Quick run command | `npm run test` |
| Full suite command | `npm run test:e2e` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SYS-02 | PWA Manifest exists | E2E | `playwright test manifest.spec.ts` | ❌ Wave 0 |
| SYS-02 | SW registers successfully | E2E | `playwright test sw.spec.ts` | ❌ Wave 0 |
| SYS-02 | Offline fallback shows | E2E | `playwright test offline.spec.ts` | ❌ Wave 0 |
| SYS-02 | 4-Breakpoint Responsive Audit | Manual | DevTools Audit (640, 1024, 1280, 1536) | — |
| SYS-02 | A11y Review (Labels/Focus/Live) | Manual | Screen Reader + Lighthouse A11y | — |

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V5 Input Validation | yes | Validate `manifest.ts` dynamic inputs |
| V14 Configuration | yes | Ensure SW doesn't cache sensitive JWT tokens |

### Known Threat Patterns for Next.js PWA

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Cache Poisoning | Tampering | Use SRI (Subresource Integrity) where possible; verify SW origin |
| Sensitive Data Leak | Information Disclosure | Exclude `/api/auth` and headers from SW caching |

## Sources

### Primary (HIGH confidence)
- [serwist.pages.dev] - Official Serwist documentation for Next.js integration.
- [nextjs.org/docs/app/api-reference/file-conventions/metadata/manifest] - Next.js manifest.ts documentation.
- [web.dev/maskable-icon] - Google's guide on maskable icons and safe zones.

### Secondary (MEDIUM confidence)
- [LogRocket: Building a PWA with Next.js 15] - Community guide for modern Next.js PWA setup.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Serwist is the clear successor to next-pwa.
- Architecture: HIGH - Native Next.js manifest is the standard.
- Pitfalls: HIGH - Maskable icon and Dev-mode caching are well-documented pain points.

**Research date:** 2026-05-27
**Valid until:** 2026-06-26
