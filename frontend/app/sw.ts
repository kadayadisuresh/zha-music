import { defaultCache } from "@serwist/next/browser";
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
    {
      matcher: ({ url }) =>
        url.pathname.startsWith("/api/search") ||
        url.pathname.startsWith("/api/recommendations") ||
        url.pathname.startsWith("/api/charts"),
      handler: "NetworkFirst",
      options: {
        cacheName: "api-cache",
        expiration: {
          maxAgeSeconds: 300, // 5 minutes
        },
      },
    },
    {
      matcher: ({ url }) =>
        url.pathname.startsWith("/api/artist") ||
        url.pathname.startsWith("/api/album"),
      handler: "StaleWhileRevalidate",
      options: {
        cacheName: "content-cache",
        expiration: {
          maxAgeSeconds: 3600, // 1 hour
        },
      },
    },
    {
      matcher: ({ url }) =>
        url.origin === "https://lh3.googleusercontent.com" ||
        url.pathname.startsWith("/_next/image"),
      handler: "CacheFirst",
      options: {
        cacheName: "image-cache",
        expiration: {
          maxAgeSeconds: 24 * 60 * 60, // 24 hours
        },
      },
    },
    {
      matcher: ({ url }) =>
        url.hostname.includes("googlevideo.com") ||
        url.pathname.startsWith("/api/proxy/stream") ||
        url.pathname.startsWith("/api/proxy/audio") ||
        url.pathname.startsWith("/api/auth/me") ||
        url.pathname.startsWith("/api/user"),
      handler: "NetworkOnly",
    },
    ...defaultCache,
  ],
});

serwist.addEventListeners();
