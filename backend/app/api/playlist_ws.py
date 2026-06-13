"""Native WebSocket hub for collaborative playlists: real-time song sync,
presence, and chat. One room per playlist_id."""
import logging
import uuid
from typing import Dict, Set

from fastapi import WebSocket
from sqlalchemy import select

from app.core.security import verify_access_token
from app.db.database import AsyncSessionLocal
from app.models.user import User
from app.models.playlist import Playlist, PlaylistSong
from app.models.playlist_message import PlaylistMessage
from app.models.playlist_collaborator import PlaylistCollaborator

logger = logging.getLogger(__name__)

MAX_CHAT_LEN = 2000


class Connection:
    __slots__ = ("ws", "user_id", "display_name", "avatar_url")

    def __init__(self, ws: WebSocket, user: User):
        self.ws = ws
        self.user_id = str(user.id)
        self.display_name = user.display_name or "Anonymous"
        self.avatar_url = user.avatar_url


class PlaylistManager:
    def __init__(self):
        # playlist_id -> set of Connection
        self.rooms: Dict[int, Set[Connection]] = {}

    # --- auth/authz ---------------------------------------------------------
    async def authenticate(self, ws: WebSocket, playlist_id: int):
        """Return (User, Playlist) if the cookie is valid and the user may
        access this playlist (owner or collaborative). Else None."""
        token = ws.cookies.get("access_token")
        user_id = verify_access_token(token) if token else None
        if not user_id:
            return None
        try:
            user_uuid = uuid.UUID(user_id)
        except ValueError:
            return None

        async with AsyncSessionLocal() as db:
            user = (await db.execute(select(User).where(User.id == user_uuid))).scalars().first()
            if not user:
                return None
            playlist = (
                await db.execute(select(Playlist).where(Playlist.id == playlist_id))
            ).scalars().first()
            if not playlist:
                return None
            if playlist.owner_id == user.id or playlist.is_collaborative:
                return user, playlist
            # Otherwise allow explicit collaborators
            collab = (
                await db.execute(
                    select(PlaylistCollaborator).where(
                        PlaylistCollaborator.playlist_id == playlist_id,
                        PlaylistCollaborator.user_id == user.id,
                    )
                )
            ).scalars().first()
            if collab:
                return user, playlist
            return None

    # --- room lifecycle -----------------------------------------------------
    async def connect(self, conn: Connection, playlist_id: int):
        self.rooms.setdefault(playlist_id, set()).add(conn)
        # Tell everyone (incl. self) that this user is here
        await self.broadcast(playlist_id, {
            "type": "presence",
            "payload": {
                "userId": conn.user_id,
                "displayName": conn.display_name,
                "avatarUrl": conn.avatar_url,
                "state": "join",
            },
        })
        # Send the joiner the current presence roster
        await conn.ws.send_json({
            "type": "sync_state",
            "payload": {"online": self._roster(playlist_id)},
        })

    def disconnect(self, conn: Connection, playlist_id: int):
        room = self.rooms.get(playlist_id)
        if room and conn in room:
            room.discard(conn)
            if not room:
                self.rooms.pop(playlist_id, None)

    def _roster(self, playlist_id: int):
        seen, out = set(), []
        for c in self.rooms.get(playlist_id, set()):
            if c.user_id in seen:
                continue
            seen.add(c.user_id)
            out.append({"userId": c.user_id, "displayName": c.display_name, "avatarUrl": c.avatar_url})
        return out

    async def broadcast(self, playlist_id: int, message: dict):
        for c in list(self.rooms.get(playlist_id, set())):
            try:
                await c.ws.send_json(message)
            except Exception:
                self.disconnect(c, playlist_id)

    # --- event handling -----------------------------------------------------
    async def handle_event(self, conn: Connection, playlist_id: int, event: dict):
        etype = event.get("type")
        payload = event.get("payload") or {}
        client_msg_id = event.get("clientMsgId")

        if etype == "chat_message":
            await self._chat(conn, playlist_id, payload, client_msg_id)
        elif etype in ("add_track", "song_add"):
            await self._add_track(conn, playlist_id, payload, client_msg_id)
        elif etype in ("remove_track", "song_remove"):
            await self._remove_track(conn, playlist_id, payload, client_msg_id)
        elif etype in ("reorder_track", "song_reorder"):
            await self._reorder_track(conn, playlist_id, payload, client_msg_id)
        elif etype == "update_version":
            await self._update_version(conn, playlist_id, payload, client_msg_id)
        elif etype == "typing":
            await self.broadcast(playlist_id, {
                "type": "typing",
                "payload": {"userId": conn.user_id, "isTyping": bool(payload.get("isTyping"))},
            })
        # unknown types are ignored

    async def _chat(self, conn: Connection, playlist_id: int, payload: dict, client_msg_id):
        text = (payload.get("text") or "").strip()
        if not text:
            return
        text = text[:MAX_CHAT_LEN]
        async with AsyncSessionLocal() as db:
            msg = PlaylistMessage(
                playlist_id=playlist_id,
                user_id=uuid.UUID(conn.user_id),
                display_name=conn.display_name,
                avatar_url=conn.avatar_url,
                text=text,
            )
            db.add(msg)
            await db.commit()
            await db.refresh(msg)
            created_at = msg.created_at
            msg_id = str(msg.id)
        await self.broadcast(playlist_id, {
            "type": "chat_message",
            "clientMsgId": client_msg_id,
            "payload": {
                "id": msg_id,
                "userId": conn.user_id,
                "displayName": conn.display_name,
                "avatarUrl": conn.avatar_url,
                "text": text,
                "createdAt": created_at.isoformat() if created_at else None,
            },
        })

    def _actor(self, conn: Connection):
        return {"userId": conn.user_id, "displayName": conn.display_name}

    async def _add_track(self, conn: Connection, playlist_id: int, payload: dict, client_msg_id):
        song_id = payload.get("songId") or payload.get("videoId")
        if not song_id:
            return
        async with AsyncSessionLocal() as db:
            count = (
                await db.execute(select(PlaylistSong).where(PlaylistSong.playlist_id == playlist_id))
            ).scalars().all()
            song = PlaylistSong(playlist_id=playlist_id, song_id=song_id, position=len(count), version=1)
            db.add(song)
            await db.commit()
            await db.refresh(song)
            new_id, position, version = song.id, song.position, song.version
        await self.broadcast(playlist_id, {
            "type": "track_added",
            "clientMsgId": client_msg_id,
            "payload": {
                "id": new_id, "songId": song_id, "position": position, "version": version,
                "actor": self._actor(conn),
            },
        })

    async def _remove_track(self, conn: Connection, playlist_id: int, payload: dict, client_msg_id):
        song_id = payload.get("songId") or payload.get("videoId")
        if not song_id:
            return
        async with AsyncSessionLocal() as db:
            song = (
                await db.execute(
                    select(PlaylistSong).where(
                        PlaylistSong.playlist_id == playlist_id,
                        PlaylistSong.song_id == song_id,
                    )
                )
            ).scalars().first()
            if song:
                await db.delete(song)
                await db.commit()
        await self.broadcast(playlist_id, {
            "type": "track_removed",
            "clientMsgId": client_msg_id,
            "payload": {"songId": song_id, "actor": self._actor(conn)},
        })

    async def _reorder_track(self, conn: Connection, playlist_id: int, payload: dict, client_msg_id):
        song_id = payload.get("songId") or payload.get("videoId")
        new_position = payload.get("newPosition")
        if not song_id or new_position is None:
            return
        async with AsyncSessionLocal() as db:
            song = (
                await db.execute(
                    select(PlaylistSong).where(
                        PlaylistSong.playlist_id == playlist_id,
                        PlaylistSong.song_id == song_id,
                    )
                )
            ).scalars().first()
            if not song:
                return
            # Last-write-wins: the server is authoritative — apply and bump version.
            song.position = int(new_position)
            song.version = (song.version or 1) + 1
            await db.commit()
            version = song.version
        await self.broadcast(playlist_id, {
            "type": "track_reordered",
            "clientMsgId": client_msg_id,
            "payload": {
                "songId": song_id, "position": int(new_position), "version": version,
                "actor": self._actor(conn),
            },
        })

    async def _update_version(self, conn: Connection, playlist_id: int, payload: dict, client_msg_id):
        """Last-write-wins version reconciliation for a single track. Only applies
        when the incoming version is newer than what the server holds."""
        song_id = payload.get("songId") or payload.get("videoId")
        incoming = payload.get("version")
        if not song_id or incoming is None:
            return
        async with AsyncSessionLocal() as db:
            song = (
                await db.execute(
                    select(PlaylistSong).where(
                        PlaylistSong.playlist_id == playlist_id,
                        PlaylistSong.song_id == song_id,
                    )
                )
            ).scalars().first()
            if not song:
                return
            current = song.version or 1
            if int(incoming) > current:
                song.version = int(incoming)
                await db.commit()
                current = song.version
        await self.broadcast(playlist_id, {
            "type": "version_updated",
            "clientMsgId": client_msg_id,
            "payload": {"songId": song_id, "version": current, "actor": self._actor(conn)},
        })


playlist_manager = PlaylistManager()
