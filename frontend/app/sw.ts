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

serwist.addEventListeners();
