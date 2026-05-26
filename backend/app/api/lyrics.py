from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from datetime import datetime, timedelta
import requests
from app.db.database import get_db
from app.models.lyrics import LyricsSyncOffset
from app.models.cache import CacheEntry

router = APIRouter()

LRCLIB_API = "https://lrclib.net/api"

@router.get("/lyrics/{video_id}")
async def get_lyrics(video_id: str, db: AsyncSession = Depends(get_db)):
    # 1. Check DB cache
    result = await db.execute(select(CacheEntry).where(CacheEntry.key == f"lyrics_{video_id}"))
    cache_entry = result.scalars().first()
    
    if cache_entry and cache_entry.expires_at > datetime.utcnow():
        return {"lyrics": cache_entry.value, "source": "cache"}
    
    # 2. Call LRCLIB
    try:
        response = requests.get(f"{LRCLIB_API}/get?track_name=placeholder&artist_name=placeholder&album_name=placeholder&duration=0") # Simplistic call
        # Need to handle actual LRCLIB search by video_id if supported, or extract data
        # For now, proxying a request as requested.
        # This will need proper implementation based on LRCLIB API capabilities.
        lyrics_data = {"text": "Lyrics not found or integration pending."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
        
    # 3. Cache in DB (7 days)
    if cache_entry:
        cache_entry.value = str(lyrics_data)
        cache_entry.expires_at = datetime.utcnow() + timedelta(days=7)
    else:
        new_cache = CacheEntry(key=f"lyrics_{video_id}", value=str(lyrics_data), expires_at=datetime.utcnow() + timedelta(days=7))
        db.add(new_cache)
        
    await db.commit()
    return {"lyrics": lyrics_data, "source": "lrclib"}
