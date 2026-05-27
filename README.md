# ഴ-zha

ഴ-zha (zha) is a clean, premium music streaming web app that feels exactly like YouTube Music and Spotify but runs entirely in your browser. It uses the InnerTube API to stream high-quality audio directly from YouTube's CDN, meaning no audio data ever touches your server.

## Key Features

- **Direct YouTube Streaming:** High-performance playback with zero server-side audio processing.
- **Intelligent Playback:** Gapless transitions, professional 0-12s crossfade, and a 500ms adaptive background color system that matches your album art.
- **Social Listening:** Real-time Jam sessions for up to 10 friends and daily-updated personal Blends based on shared listening history.
- **Full Discovery:** Search the entire YouTube Music catalog, explore regional charts, and follow your favorite artists.
- **Personal Library:** Full playlist management with drag-and-drop reordering and a robust "Like" system with optimistic UI.
- **Offline Mode:** Download your favorite tracks to IndexedDB for seamless listening without an internet connection.
- **Premium PWA:** Fully installable on mobile and desktop with a native-feel UI, background updates, and offline fallback.

## Prerequisites

- **Node.js:** v18 or higher (v20+ recommended)
- **Python:** v3.10 or higher
- **PostgreSQL:** v14 or higher

## Local Setup

### 1. Backend (FastAPI)

1.  Navigate to the backend directory: `cd backend`
2.  Create a virtual environment: `python -m venv venv`
3.  Activate it: `source venv/bin/activate` (or `venv\Scripts\activate` on Windows)
4.  Install dependencies: `pip install -r requirements.txt`
5.  Create your `.env` file based on `.env.example`.
6.  Run migrations: `alembic upgrade head`
7.  Start the server: `uvicorn app.main:app --reload`

### 2. Frontend (Next.js)

1.  Navigate to the frontend directory: `cd frontend`
2.  Install dependencies: `npm install`
3.  Create your `.env.local` file based on `.env.example`.
4.  Start development: `npm run dev`

## Deployment (Oracle Cloud)

1.  **Backend:** Deploy the FastAPI app using Oracle Container Instances or a persistent VM.
2.  **Database:** Use Oracle Autonomous Database (Postgres-compatible).
3.  **Storage:** Configure `boto3` to use Oracle Object Storage's S3-compatible API for playlist covers.
4.  **Frontend:** Deploy the Next.js app to Vercel or Oracle's container engine.

## Tech Stack

- **Frontend:** Next.js 15 (App Router), Tailwind v4, Zustand, Framer Motion, Serwist (PWA).
- **Backend:** FastAPI, SQLAlchemy, Alembic, PostgreSQL, WebSockets.
- **API:** InnerTube (youtubei.js), LRCLIB (Lyrics).
- **Storage:** IndexedDB (Local), S3-compatible (Remote).

## Known Limitations

- **iOS Background Audio:** iOS Safari may pause audio if the browser is minimized for long periods without a user interaction.
- **InnerTube Changes:** YouTube occasionally updates its internal protocols which may require updating the `youtubei.js` library.

---
*Developed with ഴ for a premium listening experience.*
