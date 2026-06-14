import withSerwistInit from "@serwist/next";
import type { NextConfig } from "next";

const withSerwist = withSerwistInit({
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV === "development",
});

const nextConfig: NextConfig = {
  // Allow the dev server (HMR websocket, RSC/data requests) to be reached from
  // other devices on the LAN. Without this, Next blocks cross-origin dev
  // requests from a non-localhost IP, which breaks HMR and client hydration —
  // the page loads but never becomes interactive when opened from a phone.
  allowedDevOrigins: ["192.168.1.33", "10.91.55.225", "10.120.115.135", "10.120.115.114"],
  devIndicators: {
    appIsrStatus: false,
    buildActivity: false,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  turbopack: {},
  serverExternalPackages: ['bgutils-js', 'jsdom'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'i.ytimg.com',
      },
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      },
      {
        protocol: 'https',
        hostname: 'yt3.ggpht.com',
      },
      {
        protocol: 'https',
        hostname: 'yt3.googleusercontent.com',
      },
      {
        protocol: 'https',
        hostname: '**.googleusercontent.com',
      },
    ],
    localPatterns: [
      {
        pathname: '/api/proxy/image',
        search: '',
      },
    ],
  },
  /* config options here */
};

export default withSerwist(nextConfig);
