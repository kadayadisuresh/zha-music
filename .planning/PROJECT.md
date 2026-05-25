# Project: ഴ-zha (YouTube Music Clone)

## Core Value
A clean, premium music streaming web app that feels exactly like YouTube Music and Spotify, but runs entirely in a browser. It uses the InnerTube API to stream directly from YouTube's CDN, meaning no audio ever touches the server.

## Target Audience
Solo developer + friends — not public.

## Key Constraints & Assumptions
- Audio NEVER passes through the server — browser calls InnerTube directly.
- Server (FastAPI) ONLY handles auth, user data, playlists, likes, Jam/Blend state.
- HTMLAudioElement only — no Howler.js, no Web Audio API.
- All components must be fully responsive (375px, 768px, 1024px, 1440px+).
- Frontend: Next.js 15 (App Router), Tailwind CSS v4, Zustand.
- Backend: FastAPI, PostgreSQL 16, SQLAlchemy.