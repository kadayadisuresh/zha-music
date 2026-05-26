from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List

from app.db.database import get_db
from app.models.playlist import Playlist, PlaylistSong
from app.models.user import User
from app.api.deps import get_current_user
from sqlalchemy import select

router = APIRouter()

@router.get("/", response_model=List[dict])
async def get_playlists(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    result = await db.execute(select(Playlist).where(Playlist.owner_id == current_user.id))
    playlists = result.scalars().all()
    return [{"id": p.id, "title": p.title, "description": p.description} for p in playlists]

@router.post("/", response_model=dict)
async def create_playlist(title: str, description: str = None, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    new_playlist = Playlist(title=title, description=description, owner_id=current_user.id)
    db.add(new_playlist)
    await db.commit()
    await db.refresh(new_playlist)
    return {"id": new_playlist.id, "title": new_playlist.title}

@router.post("/{playlist_id}/songs")
async def add_song_to_playlist(playlist_id: int, song_id: str, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    # Verify playlist belongs to user
    result = await db.execute(select(Playlist).where(Playlist.id == playlist_id, Playlist.owner_id == current_user.id))
    playlist = result.scalar_one_or_none()
    if not playlist:
        raise HTTPException(status_code=404, detail="Playlist not found")
    
    new_song = PlaylistSong(playlist_id=playlist_id, song_id=song_id, position=len(playlist.songs))
    db.add(new_song)
    await db.commit()
    return {"status": "success"}
