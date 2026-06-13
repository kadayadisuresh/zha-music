"""Jam sessions: shared real-time listening. The host controls playback;
guests can add to the queue. One WebSocket room per session_id (max 10).

The hub keeps an authoritative in-memory playback snapshot per session so a
late joiner can be told the exact current track + live position. `clock_sync`
lets each client estimate its offset from the server clock for latency
compensation.
"""
import asyncio
import logging
import secrets
import time
import uuid
from datetime import datetime, timedelta, timezone
from typing import Dict, Optional, Set

from fastapi import APIRouter, Depends, HTTPException, WebSocket, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import verify_access_token
from app.db.database import AsyncSessionLocal, get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.models.jam import JamSession, JamParticipant, JamInviteToken

logger = logging.getLogger(__name__)

MAX_PARTICIPANTS = 10
INVITE_TTL_HOURS = 24
# Grace window before a host-less session is ended, so a host page-refresh,
# brief navigation, or transient network drop doesn't kill the jam for everyone.
HOST_GRACE_SECONDS = 45

# Host-only control events
HOST_ONLY = {"play", "pause", "seek", "skip_next", "skip_prev", "queue_remove"}


def _now_ms() -> int:
    return int(time.time() * 1000)


class JamConnection:
    __slots__ = ("ws", "user_id", "display_name", "avatar_url", "role")

    def __init__(self, ws: WebSocket, user: User, role: str):
        self.ws = ws
        self.user_id = str(user.id)
        self.display_name = user.display_name or "Anonymous"
        self.avatar_url = user.avatar_url
        self.role = role  # "host" | "guest"


class JamManager:
    def __init__(self):
        # session_id -> set of connections
        self.rooms: Dict[int, Set[JamConnection]] = {}
        # session_id -> authoritative playback snapshot
        self.state: Dict[int, dict] = {}
        # session_id -> pending "end the session" timer (host left, grace window)
        self._pending_end: Dict[int, asyncio.Task] = {}

    def _host_present(self, session_id: int) -> bool:
        return any(c.role == "host" for c in self.rooms.get(session_id, set()))

    def _cancel_pending_end(self, session_id: int):
        task = self._pending_end.pop(session_id, None)
        if task and not task.done():
            task.cancel()

    def schedule_host_end(self, session_id: int):
        """Host's socket dropped — end the session only if they don't return
        within the grace window. Idempotent; a reconnect cancels it."""
        if session_id in self._pending_end:
            return

        async def _end_later():
            try:
                await asyncio.sleep(HOST_GRACE_SECONDS)
            except asyncio.CancelledError:
                return
            self._pending_end.pop(session_id, None)
            if not self._host_present(session_id):
                await self.end_session(session_id)

        self._pending_end[session_id] = asyncio.create_task(_end_later())

    # --- auth/authz ---------------------------------------------------------
    async def authenticate(self, ws: WebSocket, session_id: int):
        """Return (User, role) if the cookie is valid, the session is active,
        and the session has room (max 10). Else None."""
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
            session = (
                await db.execute(select(JamSession).where(JamSession.id == session_id))
            ).scalars().first()
            if not session or not session.is_active:
                return None

            role = "host" if session.host_id == user.id else "guest"

            # Enforce max participants (count distinct users already connected).
            current_users = {c.user_id for c in self.rooms.get(session_id, set())}
            if role != "host" and str(user.id) not in current_users:
                if len(current_users) >= MAX_PARTICIPANTS:
                    return None

            # Persist participant membership (idempotent).
            existing = (
                await db.execute(
                    select(JamParticipant).where(
                        JamParticipant.session_id == session_id,
                        JamParticipant.user_id == user.id,
                    )
                )
            ).scalars().first()
            if not existing:
                db.add(JamParticipant(session_id=session_id, user_id=user.id, role=role))
                await db.commit()

            # Seed in-memory snapshot from the DB the first time anyone connects.
            if session_id not in self.state:
                self.state[session_id] = {
                    "track_id": session.current_track_id,
                    "track": None,  # full {id,title,artists,thumbnail} for guests
                    "position_ms": session.current_position_ms or 0,
                    "is_playing": bool(session.is_playing),
                    "updated_ms": _now_ms(),
                }
            return user, role

    # --- playback snapshot ---------------------------------------------------
    def _effective_position(self, session_id: int) -> int:
        """Position the track *should* be at right now, accounting for elapsed
        wall-clock time while playing."""
        st = self.state.get(session_id)
        if not st:
            return 0
        pos = st["position_ms"]
        if st["is_playing"]:
            pos += _now_ms() - st["updated_ms"]
        return max(0, pos)

    def _apply(self, session_id: int, *, track_id=None, track=None, position_ms=None, is_playing=None):
        st = self.state.setdefault(
            session_id,
            {"track_id": None, "track": None, "position_ms": 0, "is_playing": False, "updated_ms": _now_ms()},
        )
        if track_id is not None:
            st["track_id"] = track_id
        if track is not None:
            st["track"] = track
        if position_ms is not None:
            st["position_ms"] = int(position_ms)
        if is_playing is not None:
            st["is_playing"] = bool(is_playing)
        st["updated_ms"] = _now_ms()

    async def _persist_state(self, session_id: int):
        st = self.state.get(session_id)
        if not st:
            return
        async with AsyncSessionLocal() as db:
            session = (
                await db.execute(select(JamSession).where(JamSession.id == session_id))
            ).scalars().first()
            if session:
                session.current_track_id = st["track_id"]
                session.current_position_ms = self._effective_position(session_id)
                session.is_playing = st["is_playing"]
                await db.commit()

    def _sync_payload(self, session_id: int) -> dict:
        st = self.state.get(session_id) or {}
        return {
            "currentTrackId": st.get("track_id"),
            "track": st.get("track"),
            "positionMs": self._effective_position(session_id),
            "isPlaying": bool(st.get("is_playing")),
            "serverTimeMs": _now_ms(),
            "participants": self._roster(session_id),
        }

    # --- room lifecycle -----------------------------------------------------
    async def connect(self, conn: JamConnection, session_id: int):
        self.rooms.setdefault(session_id, set()).add(conn)
        # Host came back within the grace window → keep the session alive.
        if conn.role == "host":
            self._cancel_pending_end(session_id)
        # Notify everyone that a participant joined.
        await self.broadcast(session_id, {
            "type": "participant_join",
            "payload": {
                "userId": conn.user_id,
                "displayName": conn.display_name,
                "avatarUrl": conn.avatar_url,
                "role": conn.role,
            },
        })
        # Send the joiner the live state so they can seek to the right spot.
        await conn.ws.send_json({"type": "sync_state", "payload": self._sync_payload(session_id)})

    def disconnect(self, conn: JamConnection, session_id: int):
        room = self.rooms.get(session_id)
        if room and conn in room:
            room.discard(conn)
        # Is this user still present on another socket?
        still_present = any(c.user_id == conn.user_id for c in self.rooms.get(session_id, set()))
        return still_present

    def _roster(self, session_id: int):
        seen, out = set(), []
        for c in self.rooms.get(session_id, set()):
            if c.user_id in seen:
                continue
            seen.add(c.user_id)
            out.append({
                "userId": c.user_id,
                "displayName": c.display_name,
                "avatarUrl": c.avatar_url,
                "role": c.role,
            })
        return out

    async def broadcast(self, session_id: int, message: dict, exclude: WebSocket = None):
        for c in list(self.rooms.get(session_id, set())):
            if exclude is not None and c.ws is exclude:
                continue
            try:
                await c.ws.send_json(message)
            except Exception:
                self.rooms.get(session_id, set()).discard(c)

    async def end_session(self, session_id: int):
        """Mark inactive, tell everyone, and drop the room."""
        self._cancel_pending_end(session_id)
        async with AsyncSessionLocal() as db:
            session = (
                await db.execute(select(JamSession).where(JamSession.id == session_id))
            ).scalars().first()
            if session:
                session.is_active = False
                await db.commit()
        await self.broadcast(session_id, {"type": "session_ended", "payload": {}})
        self.rooms.pop(session_id, None)
        self.state.pop(session_id, None)

    # --- event handling -----------------------------------------------------
    async def handle_event(self, conn: JamConnection, session_id: int, event: dict):
        etype = event.get("type")
        payload = event.get("payload") or {}

        # clock_sync is allowed for everyone and is a direct reply (no broadcast).
        if etype == "clock_sync":
            await conn.ws.send_json({
                "type": "clock_sync",
                "payload": {"t0": payload.get("t0"), "serverTimeMs": _now_ms()},
            })
            return

        if etype == "sync_state":
            # A client explicitly requests the current state.
            await conn.ws.send_json({"type": "sync_state", "payload": self._sync_payload(session_id)})
            return

        # Host-only control events: silently ignore from guests.
        if etype in HOST_ONLY and conn.role != "host":
            return

        if etype == "play":
            self._apply(session_id, track_id=payload.get("trackId") or self.state.get(session_id, {}).get("track_id"),
                        track=payload.get("track"), position_ms=payload.get("positionMs"), is_playing=True)
            await self._broadcast_playback(session_id, "play", conn)
        elif etype == "pause":
            self._apply(session_id, track=payload.get("track"), position_ms=payload.get("positionMs"), is_playing=False)
            await self._broadcast_playback(session_id, "pause", conn)
        elif etype == "seek":
            self._apply(session_id, track=payload.get("track"), position_ms=payload.get("positionMs"))
            await self._broadcast_playback(session_id, "seek", conn)
        elif etype in ("skip_next", "skip_prev"):
            self._apply(session_id, track_id=payload.get("trackId"), track=payload.get("track"),
                        position_ms=0, is_playing=True)
            await self._broadcast_playback(session_id, etype, conn)
        elif etype == "queue_add":
            await self.broadcast(session_id, {
                "type": "queue_add",
                "payload": {
                    "track": payload.get("track"),
                    "videoId": payload.get("videoId") or (payload.get("track") or {}).get("id"),
                    "addedBy": conn.display_name,
                    "addedById": conn.user_id,
                },
            })
        elif etype == "queue_remove":
            await self.broadcast(session_id, {
                "type": "queue_remove",
                "payload": {"queueId": payload.get("queueId"), "videoId": payload.get("videoId")},
            })
        elif etype == "chat":
            # Anyone in the jam can chat. Broadcast to everyone (incl. sender) so
            # all clients render the same server-confirmed message.
            text = (payload.get("text") or "").strip()
            if not text:
                return
            await self.broadcast(session_id, {
                "type": "chat",
                "payload": {
                    "id": uuid.uuid4().hex,
                    "userId": conn.user_id,
                    "displayName": conn.display_name,
                    "avatarUrl": conn.avatar_url,
                    "text": text[:500],
                    "createdAt": datetime.now(timezone.utc).isoformat(),
                },
            })
        # unknown types ignored

    async def _broadcast_playback(self, session_id: int, kind: str, conn: JamConnection):
        st = self.state.get(session_id) or {}
        await self.broadcast(session_id, {
            "type": kind,
            "payload": {
                "trackId": st.get("track_id"),
                "track": st.get("track"),
                "positionMs": self._effective_position(session_id),
                "isPlaying": bool(st.get("is_playing")),
                "serverTimeMs": _now_ms(),
                "actor": conn.display_name,
            },
        }, exclude=conn.ws)
        await self._persist_state(session_id)


jam_manager = JamManager()


# ===========================================================================
# REST API
# ===========================================================================
router = APIRouter()


def _new_join_code() -> str:
    # 8-char URL-safe alphanumeric (SRD 5.16 / threat model)
    alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    return "".join(secrets.choice(alphabet) for _ in range(8))


async def _issue_invite(db: AsyncSession, session_id: int) -> str:
    token = secrets.token_urlsafe(24)
    db.add(JamInviteToken(
        token=token,
        session_id=session_id,
        expires_at=datetime.now(timezone.utc) + timedelta(hours=INVITE_TTL_HOURS),
    ))
    return token


@router.post("/start")
async def start_jam(
    track_id: str | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new jam session hosted by the current user. Returns the
    session_id, join_code, and a shareable invite token."""
    # Generate a unique join code.
    for _ in range(5):
        code = _new_join_code()
        clash = (await db.execute(select(JamSession).where(JamSession.join_code == code))).scalars().first()
        if not clash:
            break

    session = JamSession(
        join_code=code,
        host_id=current_user.id,
        current_track_id=track_id,
        current_position_ms=0,
        is_playing=False,
        is_active=True,
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)

    db.add(JamParticipant(session_id=session.id, user_id=current_user.id, role="host"))
    token = await _issue_invite(db, session.id)
    await db.commit()

    return {
        "session_id": session.id,
        "join_code": session.join_code,
        "invite_token": token,
    }


@router.get("/join/{token}")
async def join_jam(
    token: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Resolve an invite token (or an 8-char join code) to a session and join
    it as a guest. Enforces the 10-participant cap."""
    invite = (
        await db.execute(select(JamInviteToken).where(JamInviteToken.token == token))
    ).scalars().first()

    session = None
    if invite:
        if invite.expires_at and invite.expires_at < datetime.now(timezone.utc):
            raise HTTPException(status_code=410, detail="Invite expired")
        session = (
            await db.execute(select(JamSession).where(JamSession.id == invite.session_id))
        ).scalars().first()
    else:
        # Fall back to treating the token as a join code.
        session = (
            await db.execute(select(JamSession).where(JamSession.join_code == token.upper()))
        ).scalars().first()

    if not session or not session.is_active:
        raise HTTPException(status_code=404, detail="Jam session not found or ended")

    role = "host" if session.host_id == current_user.id else "guest"

    already = (
        await db.execute(
            select(JamParticipant).where(
                JamParticipant.session_id == session.id,
                JamParticipant.user_id == current_user.id,
            )
        )
    ).scalars().first()

    if not already:
        count = (
            await db.execute(
                select(func.count()).select_from(JamParticipant).where(
                    JamParticipant.session_id == session.id
                )
            )
        ).scalar() or 0
        if count >= MAX_PARTICIPANTS:
            raise HTTPException(status_code=409, detail="Session is full — max 10 people")
        db.add(JamParticipant(session_id=session.id, user_id=current_user.id, role=role))
        await db.commit()

    return {"session_id": session.id, "join_code": session.join_code, "role": role}


@router.get("/{session_id}/state")
async def get_jam_state(
    session_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Current state for late joiners (also reflects the live in-memory position)."""
    session = (
        await db.execute(select(JamSession).where(JamSession.id == session_id))
    ).scalars().first()
    if not session:
        raise HTTPException(status_code=404, detail="Jam session not found")

    live = jam_manager.state.get(session_id)
    if live:
        position_ms = jam_manager._effective_position(session_id)
        track_id = live["track_id"]
        is_playing = live["is_playing"]
    else:
        position_ms = session.current_position_ms or 0
        track_id = session.current_track_id
        is_playing = session.is_playing

    return {
        "session_id": session.id,
        "is_active": session.is_active,
        "host_id": str(session.host_id),
        "currentTrackId": track_id,
        "positionMs": position_ms,
        "isPlaying": is_playing,
        "serverTimeMs": _now_ms(),
        "participants": jam_manager._roster(session_id),
    }


@router.delete("/{session_id}")
async def end_jam(
    session_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """End the session. Host only."""
    session = (
        await db.execute(select(JamSession).where(JamSession.id == session_id))
    ).scalars().first()
    if not session:
        raise HTTPException(status_code=404, detail="Jam session not found")
    if session.host_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the host can end the session")

    await jam_manager.end_session(session_id)
    return {"status": "ended"}
