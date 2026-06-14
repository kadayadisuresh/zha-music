from fastapi import APIRouter, HTTPException, Query
from ytmusicapi import YTMusic
from typing import List, Optional

router = APIRouter()
ytmusic = YTMusic()

# Phase 17 · Slice 4 — stream resolution now lives entirely in the Next.js
# youtubei.js route handlers (/api/innertube/pipe + /stream). yt-dlp and the
# audio resolve/proxy endpoints have been removed; only radio (ytmusicapi)
# remains here, and that moves off FastAPI in Slice 5.


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
