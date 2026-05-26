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

@router.get("/proxy/{video_id}")
async def audio_proxy(
    video_id: str,
    request: Request,
    range: str = Header(None)
):
    """
    Proxies audio from YouTube CDN. Used as a fallback when direct-to-browser
    streaming fails (e.g., 403 Forbidden). Supports HTTP Range requests for seeking.
    """
    
    # 1. Resolve stream URL from Next.js internal API
    # Note: In production, this might need an internal DNS name or a secret
    stream_api_url = f"{settings.FRONTEND_URL}/api/innertube/stream?videoId={video_id}"
    
    try:
        # We use a shorter timeout for the resolution call
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(stream_api_url)
            if resp.status_code != 200:
                print(f"[Audio Proxy] Resolution failed with status {resp.status_code}: {resp.text}")
                raise HTTPException(status_code=502, detail="Failed to resolve stream URL")
            
            data = resp.json()
            target_url = data.get("url")
    except Exception as e:
        print(f"[Audio Proxy] Error resolving stream URL: {e}")
        raise HTTPException(status_code=502, detail=f"Error resolving stream URL: {str(e)}")

    if not target_url:
        raise HTTPException(status_code=404, detail="Stream URL not found in resolution response")

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
