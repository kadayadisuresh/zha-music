import { defaultCache } from "@serwist/next/worker";
import {
  type PrecacheEntry,
  type SerwistGlobalConfig,
  Serwist,
  NetworkOnly,
  CacheFirst,
  ExpirationPlugin,
} from "serwist";

declare global {
  interface ServiceWorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    // Dynamic API responses + audio CDN traffic: always network, never cached.
    // NOTE: handlers passed to `new Serwist()` MUST be Strategy *instances* — a
    // bare string ("NetworkOnly") is wrapped as { handle: "NetworkOnly" } and
    // throws when invoked, which is what was breaking /api/* with "Failed to
    // fetch".
    {
      matcher: ({ url }) =>
        url.pathname.startsWith("/api/") ||
        url.hostname.includes("googlevideo.com"),
      handler: new NetworkOnly(),
    },
    // Images are safe to cache.
    {
      matcher: ({ url }) =>
        url.origin === "https://lh3.googleusercontent.com" ||
        url.pathname.startsWith("/_next/image"),
      handler: new CacheFirst({
        cacheName: "image-cache",
        plugins: [new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 24 * 60 * 60 })],
      }),
    },
    ...defaultCache,
  ],
});

// Audio streaming must NOT be handled by the service worker. While seeking, a
// media element fires many *abortable* range requests; when those are proxied
// through the SW's fetch() the aborts surface as net::ERR_FAILED, which kills the
// demuxer and makes the track reload from 0 — i.e. "the song restarts when you
// move the playbar". The server serves ranges fine (verified: even 40 concurrent
// range fetches return 206); only the media-element-through-SW path breaks. By
// stopping propagation here — before serwist's own fetch listener runs — and not
// calling respondWith, these requests fall through to native browser networking,
// which handles range/seek/abort correctly. Registered before addEventListeners()
// so this listener runs first.
self.addEventListener("fetch", (event) => {
  const { pathname } = new URL(event.request.url);
  if (pathname === "/api/innertube/pipe" || pathname === "/api/innertube/stream") {
    event.stopImmediatePropagation();
  }
});

serwist.addEventListeners();
