from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime, timedelta

from app.db.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.models.play_history import PlayHistory

router = APIRouter()


class PlayRecord(BaseModel):
    video_id: str
    title: str
    artist: str
    thumbnail_url: Optional[str] = None
    play_duration_seconds: int = 0


@router.post("/me/history")
async def record_play(
    play: PlayRecord,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    entry = PlayHistory(
        user_id=current_user.id,
        video_id=play.video_id,
        title=play.title,
        artist=play.artist,
        thumbnail_url=play.thumbnail_url,
        play_duration_seconds=max(0, play.play_duration_seconds),
    )
    db.add(entry)
    await db.commit()
    return {"status": "recorded"}


@router.get("/me/history")
async def get_history(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    res = await db.execute(
        select(PlayHistory)
        .where(PlayHistory.user_id == current_user.id)
        .order_by(desc(PlayHistory.played_at))
        .limit(limit)
        .offset(offset)
    )
    rows = res.scalars().all()
    return [
        {
            "video_id": r.video_id,
            "title": r.title,
            "artist": r.artist,
            "thumbnail_url": r.thumbnail_url,
            "played_at": r.played_at.isoformat() if r.played_at else None,
        }
        for r in rows
    ]


@router.get("/me/recently-played")
async def recently_played(
    limit: int = Query(20, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Pull a window of recent plays, then de-duplicate by video_id keeping the
    # most recent occurrence (SRD 5.13 Recently Played, chronological).
    res = await db.execute(
        select(PlayHistory)
        .where(PlayHistory.user_id == current_user.id)
        .order_by(desc(PlayHistory.played_at))
        .limit(limit * 5)
    )
    rows = res.scalars().all()
    seen = set()
    out = []
    for r in rows:
        if r.video_id in seen:
            continue
        seen.add(r.video_id)
        out.append({
            "video_id": r.video_id,
            "title": r.title,
            "artist": r.artist,
            "thumbnail_url": r.thumbnail_url,
            "played_at": r.played_at.isoformat() if r.played_at else None,
        })
        if len(out) >= limit:
            break
    return out


@router.get("/me/top-tracks")
async def top_tracks(
    days: int = Query(30, ge=1, le=365),
    limit: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Top tracks by play count over the window (used by Blend).
    since = datetime.utcnow() - timedelta(days=days)
    res = await db.execute(
        select(
            PlayHistory.video_id,
            func.max(PlayHistory.title).label("title"),
            func.max(PlayHistory.artist).label("artist"),
            func.max(PlayHistory.thumbnail_url).label("thumbnail_url"),
            func.count().label("play_count"),
        )
        .where(PlayHistory.user_id == current_user.id, PlayHistory.played_at >= since)
        .group_by(PlayHistory.video_id)
        .order_by(desc("play_count"))
        .limit(limit)
    )
    return [
        {
            "video_id": row.video_id,
            "title": row.title,
            "artist": row.artist,
            "thumbnail_url": row.thumbnail_url,
            "play_count": row.play_count,
        }
        for row in res.all()
    ]
