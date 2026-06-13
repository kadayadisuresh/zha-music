from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional
from pydantic import BaseModel

from app.db.database import get_db
from app.models.user import User
from app.models.playlist import Playlist
from app.models.followed_artist import FollowedArtist
from app.models.liked_album import LikedAlbum
from app.api.deps import get_current_user
from sqlalchemy import select, delete

router = APIRouter()

class AlbumLikeRequest(BaseModel):
    album_id: str
    title: str
    artist_name: str
    thumbnail_url: Optional[str] = None

class ArtistFollowRequest(BaseModel):
    channel_id: str
    name: str
    thumbnail_url: Optional[str] = None

@router.get("/items", response_model=List[dict])
async def get_library_items(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    # 1. Fetch user's playlists
    playlists_res = await db.execute(
        select(Playlist).where(Playlist.owner_id == current_user.id).order_by(Playlist.created_at.desc())
    )
    playlists = playlists_res.scalars().all()
    
    # 2. Fetch user's liked albums
    albums_res = await db.execute(
        select(LikedAlbum).where(LikedAlbum.user_id == current_user.id).order_by(LikedAlbum.liked_at.desc())
    )
    albums = albums_res.scalars().all()
    
    # 3. Fetch user's followed artists
    artists_res = await db.execute(
        select(FollowedArtist).where(FollowedArtist.user_id == current_user.id).order_by(FollowedArtist.followed_at.desc())
    )
    artists = artists_res.scalars().all()
    
    # Combine results
    items = []
    
    for p in playlists:
        items.append({
            "id": str(p.id),
            "type": "playlist",
            "title": p.title,
            "subtitle": "Playlist • You",
            "thumbnail_url": None
        })
        
    for a in albums:
        items.append({
            "id": a.album_id,
            "type": "album",
            "title": a.title,
            "subtitle": f"Album • {a.artist_name}",
            "thumbnail_url": a.thumbnail_url
        })
        
    for art in artists:
        items.append({
            "id": art.channel_id,
            "type": "artist",
            "title": art.name,
            "subtitle": "Artist",
            "thumbnail_url": art.thumbnail_url
        })
        
    return items

# Likes status
@router.get("/albums/{album_id}/status")
async def get_album_status(album_id: str, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    res = await db.execute(
        select(LikedAlbum).where(LikedAlbum.user_id == current_user.id, LikedAlbum.album_id == album_id)
    )
    liked = res.scalar_one_or_none() is not None
    return {"liked": liked}

@router.post("/albums")
async def like_album(req: AlbumLikeRequest, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    # Check if already liked
    res = await db.execute(
        select(LikedAlbum).where(LikedAlbum.user_id == current_user.id, LikedAlbum.album_id == req.album_id)
    )
    existing = res.scalar_one_or_none()
    if existing:
        return {"status": "success", "message": "Already liked"}
        
    new_like = LikedAlbum(
        user_id=current_user.id,
        album_id=req.album_id,
        title=req.title,
        artist_name=req.artist_name,
        thumbnail_url=req.thumbnail_url
    )
    db.add(new_like)
    await db.commit()
    return {"status": "success"}

@router.delete("/albums/{album_id}")
async def unlike_album(album_id: str, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    await db.execute(
        delete(LikedAlbum).where(LikedAlbum.user_id == current_user.id, LikedAlbum.album_id == album_id)
    )
    await db.commit()
    return {"status": "success"}

# Follows status
@router.get("/artists/{channel_id}/status")
async def get_artist_status(channel_id: str, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    res = await db.execute(
        select(FollowedArtist).where(FollowedArtist.user_id == current_user.id, FollowedArtist.channel_id == channel_id)
    )
    followed = res.scalar_one_or_none() is not None
    return {"followed": followed}

@router.post("/artists")
async def follow_artist(req: ArtistFollowRequest, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    # Check if already followed
    res = await db.execute(
        select(FollowedArtist).where(FollowedArtist.user_id == current_user.id, FollowedArtist.channel_id == req.channel_id)
    )
    existing = res.scalar_one_or_none()
    if existing:
        return {"status": "success", "message": "Already followed"}
        
    new_follow = FollowedArtist(
        user_id=current_user.id,
        channel_id=req.channel_id,
        name=req.name,
        thumbnail_url=req.thumbnail_url
    )
    db.add(new_follow)
    await db.commit()
    return {"status": "success"}

@router.delete("/artists/{channel_id}")
async def unfollow_artist(channel_id: str, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    await db.execute(
        delete(FollowedArtist).where(FollowedArtist.user_id == current_user.id, FollowedArtist.channel_id == channel_id)
    )
    await db.commit()
    return {"status": "success"}
