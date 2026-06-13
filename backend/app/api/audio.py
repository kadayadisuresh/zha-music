from fastapi import APIRouter, Header, Request, HTTPException, Query
from fastapi.responses import StreamingResponse
import httpx
from app.core.config import settings
from ytmusicapi import YTMusic
from typing import List, Optional

router = APIRouter()
ytmusic = YTMusic()

# Singleton client for connection pooling
# We use a longer timeout for the YouTube stream
http_client = httpx.AsyncClient(timeout=10.0)

@router.get("/radio")
async def get_radio(
    videoId: str,
    history: Optional[List[str]] = Query(None)
):
    """
    Fetches radio suggestions using ytmusicapi.
    """
    try:
        # Get watch playlist for radio
        playlist = ytmusic.get_watch_playlist(videoId=videoId)
        tracks = playlist.get("tracks", [])

        # Filter duplicates against history
        filtered_tracks = []
        if history:
            history_set = set(history)
            for track in tracks:
                if track.get("videoId") not in history_set:
                    filtered_tracks.append(track)
        else:
            filtered_tracks = tracks

        return {"tracks": filtered_tracks}
    except Exception as e:
        print(f"[Radio API] Error: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch radio suggestions")

import time
import asyncio
import yt_dlp

# In-process resolve cache: video_id -> (expires_epoch, {url, content_length, mime_type})
# yt-dlp is imported once at module load (warm), so resolution avoids any Python
# subprocess cold-start. The cache then skips repeated extract_info calls.
_resolve_cache: dict[str, tuple[float, dict]] = {}
_RESOLVE_TTL = 300  # 5 minutes (YouTube CDN URLs are short-lived)


def _extract_stream(video_id: str) -> dict:
    """Blocking yt-dlp resolution. Run via asyncio.to_thread so the event loop
    isn't blocked while YouTube is contacted."""
    ydl_opts = {'format': 'bestaudio/best', 'quiet': True, 'no_warnings': True}
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(f"https://www.youtube.com/watch?v={video_id}", download=False)
    acodec = info.get('acodec', '') or ''
    mime_type = 'audio/webm'
    if 'opus' in acodec:
        mime_type = 'audio/webm; codecs=opus'
    elif 'mp4a' in acodec or 'aac' in acodec:
        mime_type = 'audio/mp4'
    return {
        'url': info.get('url'),
        'content_length': info.get('filesize') or info.get('filesize_approx') or 0,
        'mime_type': mime_type,
    }


async def resolve_stream(video_id: str) -> dict:
    """Cached, non-blocking stream resolution."""
    now = time.time()
    cached = _resolve_cache.get(video_id)
    if cached and cached[0] > now:
        return cached[1]
    data = await asyncio.to_thread(_extract_stream, video_id)
    if not data.get('url'):
        raise HTTPException(status_code=404, detail="Stream URL not found")
    _resolve_cache[video_id] = (now + _RESOLVE_TTL, data)
    # Bound cache size
    if len(_resolve_cache) > 200:
        for k in [k for k, v in _resolve_cache.items() if v[0] < now]:
            _resolve_cache.pop(k, None)
    return data


@router.get("/resolve/{video_id}")
async def audio_resolve(video_id: str):
    """
    Resolves the direct YouTube CDN stream URL for a video without proxying.
    Returns the URL, content_length, and mime_type so the browser can download directly.
    """
    try:
        return await resolve_stream(video_id)
    except HTTPException:
        raise
    except Exception as e:
        print(f"[Audio Resolve] Error resolving stream URL: {e}")
        raise HTTPException(status_code=502, detail=f"Error resolving stream URL: {str(e)}")

@router.get("/proxy/{video_id}")
async def audio_proxy(
    video_id: str,
    request: Request,
    range: str = Header(None)
):
    """
    Proxies audio from YouTube CDN. Uses yt-dlp to resolve the stream URL.
    Supports HTTP Range requests for seeking.
    """
    
    # 1. Resolve stream URL (cached, in-process yt-dlp)
    try:
        resolved = await resolve_stream(video_id)
        target_url = resolved['url']
    except HTTPException:
        raise
    except Exception as e:
        print(f"[Audio Proxy] Error resolving stream URL with yt-dlp: {e}")
        raise HTTPException(status_code=502, detail=f"Error resolving stream URL: {str(e)}")

    if not target_url:
        raise HTTPException(status_code=404, detail="Stream URL not found")

    # 2. Forward request to YouTube CDN with Range support
    headers = {}
    if range:
        headers["Range"] = range

    try:
        # We use stream=True to pipe the response directly
        # The request is made to the YouTube CDN URL
        # follow_redirects=True is important as YT URLs might redirect
        
        # We don't use 'with' here because StreamingResponse needs to keep the stream open
        # It will handle closing it when done.
        yt_req = http_client.build_request("GET", target_url, headers=headers)
        yt_resp = await http_client.send(yt_req, stream=True, follow_redirects=True)
        
        # Check if YT returned an error
        if yt_resp.status_code >= 400:
            await yt_resp.aclose()
            raise HTTPException(status_code=yt_resp.status_code, detail="YouTube CDN rejected the request")

        # Forward relevant headers
        response_headers = {
            "Content-Type": yt_resp.headers.get("Content-Type"),
            "Content-Length": yt_resp.headers.get("Content-Length"),
            "Accept-Ranges": yt_resp.headers.get("Accept-Ranges"),
            "Content-Range": yt_resp.headers.get("Content-Range"),
            "Cache-Control": "public, max-age=3600",
        }
        # Remove None values
        response_headers = {k: v for k, v in response_headers.items() if v is not None}

        return StreamingResponse(
            yt_resp.aiter_bytes(),
            status_code=yt_resp.status_code,
            headers=response_headers,
            background=None # Ensures the stream is closed after response
        )
    except Exception as e:
        print(f"[Audio Proxy] Error proxying stream: {e}")
        raise HTTPException(status_code=500, detail="Error proxying audio stream")
