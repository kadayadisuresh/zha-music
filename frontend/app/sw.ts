import { defaultCache } from "@serwist/next/worker";
import { type PrecacheEntry, Serwist, type SerwistGlobalConfig } from "serwist";

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
    // Dynamic API responses and audio CDN traffic must always hit the network and
    // never be cached by the SW. Caching /api/* (NetworkFirst with a malformed
    // `expiration` config) was making the strategy reject → "Failed to fetch" on
    // /api/search etc. once the SW took control.
    {
      matcher: ({ url }) =>
        url.pathname.startsWith("/api/") ||
        url.hostname.includes("googlevideo.com"),
      handler: "NetworkOnly",
    },
    // Images are safe to cache.
    {
      matcher: ({ url }) =>
        url.origin === "https://lh3.googleusercontent.com" ||
        url.pathname.startsWith("/_next/image"),
      handler: "CacheFirst",
      options: {
        cacheName: "image-cache",
        expiration: {
          maxEntries: 200,
          maxAgeSeconds: 24 * 60 * 60, // 24 hours
        },
      },
    },
    ...defaultCache,
  ],
});

serwist.addEventListeners();
