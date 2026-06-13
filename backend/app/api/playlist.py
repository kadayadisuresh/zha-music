from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from typing import List
import secrets
from datetime import datetime, timedelta, timezone

from app.db.database import get_db
from app.models.playlist import Playlist, PlaylistSong
from app.models.playlist_message import PlaylistMessage
from app.models.playlist_collaborator import PlaylistCollaborator
from app.models.playlist_invite_token import PlaylistInviteToken
from app.models.user import User
from app.api.deps import get_current_user
from sqlalchemy import select, desc

router = APIRouter()

async def _authorized_playlist(db, playlist_id: int, user: User):
    """Owner, any collaborative playlist, or an explicit collaborator."""
    result = await db.execute(
        select(Playlist).where(
            (Playlist.id == playlist_id)
            & ((Playlist.owner_id == user.id) | (Playlist.is_collaborative == True))
        )
    )
    playlist = result.scalar_one_or_none()
    if playlist:
        return playlist
    # Fall back to explicit collaborator membership
    collab = (
        await db.execute(
            select(PlaylistCollaborator).where(
                PlaylistCollaborator.playlist_id == playlist_id,
                PlaylistCollaborator.user_id == user.id,
            )
        )
    ).scalars().first()
    if collab:
        return (
            await db.execute(select(Playlist).where(Playlist.id == playlist_id))
        ).scalar_one_or_none()
    return None

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
    result = await db.execute(
        select(Playlist)
        .where(Playlist.id == playlist_id, Playlist.owner_id == current_user.id)
        .options(selectinload(Playlist.songs))
    )
    playlist = result.scalar_one_or_none()
    if not playlist:
        raise HTTPException(status_code=404, detail="Playlist not found")
    
    new_song = PlaylistSong(playlist_id=playlist_id, song_id=song_id, position=len(playlist.songs))
    db.add(new_song)
    await db.commit()
    return {"status": "success"}

@router.get("/{playlist_id}", response_model=dict)
async def get_playlist(playlist_id: int, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    result = await db.execute(
        select(Playlist)
        .where(
            (Playlist.id == playlist_id) & 
            ((Playlist.owner_id == current_user.id) | (Playlist.is_collaborative == True))
        )
        .options(selectinload(Playlist.songs))
    )
    playlist = result.scalar_one_or_none()
    if not playlist:
        raise HTTPException(status_code=404, detail="Playlist not found")
    
    return {
        "id": playlist.id,
        "title": playlist.title,
        "description": playlist.description,
        "cover_url": playlist.cover_url,
        "is_collaborative": playlist.is_collaborative,
        "invite_token": playlist.invite_token,
        "owner_id": playlist.owner_id,
        "songs": [{"song_id": s.song_id, "position": s.position} for s in playlist.songs]
    }


@router.delete("/{playlist_id}", response_model=dict)
async def delete_playlist(playlist_id: int, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    result = await db.execute(
        select(Playlist)
        .where(Playlist.id == playlist_id, Playlist.owner_id == current_user.id)
    )
    playlist = result.scalar_one_or_none()
    if not playlist:
        raise HTTPException(status_code=404, detail="Playlist not found")
    
    await db.delete(playlist)
    await db.commit()
    return {"status": "success"}

@router.delete("/{playlist_id}/songs/{song_id}", response_model=dict)
async def remove_song_from_playlist(playlist_id: int, song_id: str, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    result = await db.execute(
        select(Playlist)
        .where(Playlist.id == playlist_id, Playlist.owner_id == current_user.id)
    )
    playlist = result.scalar_one_or_none()
    if not playlist:
        raise HTTPException(status_code=404, detail="Playlist not found")
    
    song_result = await db.execute(
        select(PlaylistSong)
        .where(PlaylistSong.playlist_id == playlist_id, PlaylistSong.song_id == song_id)
    )
    song = song_result.scalar_one_or_none()
    if not song:
        raise HTTPException(status_code=404, detail="Song not found in playlist")
        
    await db.delete(song)
    await db.commit()
    return {"status": "success"}

@router.patch("/{playlist_id}/collaborative")
async def toggle_collaborative(playlist_id: int, enabled: bool | None = None, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Toggle (or explicitly set) collaborative mode. Owner only."""
    result = await db.execute(select(Playlist).where(Playlist.id == playlist_id, Playlist.owner_id == current_user.id))
    playlist = result.scalar_one_or_none()
    if not playlist:
        raise HTTPException(status_code=404, detail="Playlist not found")

    playlist.is_collaborative = (not playlist.is_collaborative) if enabled is None else enabled
    await db.commit()
    return {"is_collaborative": playlist.is_collaborative}


@router.post("/{playlist_id}/invite")
async def generate_invite(playlist_id: int, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Generate a 32-char invite token (7-day expiry) for a collaborative playlist."""
    result = await db.execute(select(Playlist).where(Playlist.id == playlist_id, Playlist.owner_id == current_user.id))
    playlist = result.scalar_one_or_none()
    if not playlist:
        raise HTTPException(status_code=404, detail="Playlist not found")

    # Inviting implies collaboration is on
    if not playlist.is_collaborative:
        playlist.is_collaborative = True

    token = secrets.token_urlsafe(24)  # 32 url-safe characters
    expires_at = datetime.utcnow() + timedelta(days=7)
    db.add(PlaylistInviteToken(
        token=token,
        playlist_id=playlist_id,
        created_by=current_user.id,
        expires_at=expires_at,
    ))
    await db.commit()
    return {"token": token, "expires_at": expires_at.isoformat(), "playlist_id": playlist_id}

@router.get("/{playlist_id}/messages", response_model=List[dict])
async def get_playlist_messages(
    playlist_id: int,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    playlist = await _authorized_playlist(db, playlist_id, current_user)
    if not playlist:
        raise HTTPException(status_code=404, detail="Playlist not found")

    limit = max(1, min(limit, 100))
    result = await db.execute(
        select(PlaylistMessage)
        .where(PlaylistMessage.playlist_id == playlist_id)
        .order_by(desc(PlaylistMessage.created_at))
        .limit(limit)
    )
    rows = result.scalars().all()
    # Return chronological (oldest first) for natural chat rendering
    return [
        {
            "id": str(m.id),
            "userId": str(m.user_id),
            "displayName": m.display_name,
            "avatarUrl": m.avatar_url,
            "text": m.text,
            "createdAt": m.created_at.isoformat() if m.created_at else None,
        }
        for m in reversed(rows)
    ]


@router.get("/join/{token}")
async def join_playlist(token: str, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Validate an invite token and add the current user as a collaborator."""
    invite = (
        await db.execute(select(PlaylistInviteToken).where(PlaylistInviteToken.token == token))
    ).scalars().first()
    if not invite or (invite.expires_at and invite.expires_at < datetime.now(timezone.utc)):
        raise HTTPException(status_code=404, detail="Invalid or expired invite")

    playlist = (
        await db.execute(select(Playlist).where(Playlist.id == invite.playlist_id))
    ).scalar_one_or_none()
    if not playlist:
        raise HTTPException(status_code=404, detail="Playlist not found")

    # Owner doesn't need a collaborator row
    if playlist.owner_id != current_user.id:
        existing = (
            await db.execute(
                select(PlaylistCollaborator).where(
                    PlaylistCollaborator.playlist_id == playlist.id,
                    PlaylistCollaborator.user_id == current_user.id,
                )
            )
        ).scalars().first()
        if not existing:
            db.add(PlaylistCollaborator(
                playlist_id=playlist.id,
                user_id=current_user.id,
                role="editor",
            ))
    if not playlist.is_collaborative:
        playlist.is_collaborative = True
    await db.commit()

    return {"playlist_id": playlist.id, "title": playlist.title}
