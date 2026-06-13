import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.core.config import settings
from app.api.auth import router as auth_router
from app.api.audio import router as audio_router
from app.api.playlist import router as playlist_router
from app.api.blend import router as blend_router
from app.api.library import router as library_router
from app.api.users import router as users_router
from app.api.jam import jam_manager, router as jam_router, JamConnection
from app.api.playlist_ws import playlist_manager, Connection as PlaylistConnection
from app.core.scheduler import register_scheduler
from fastapi import WebSocket, WebSocketDisconnect, Depends
from app.api.deps import get_current_user
from app.db.database import engine
from app.models.base import Base
import app.models.base_all

app = FastAPI(title="zha API")

# Allow the configured frontend origin, plus any localhost or private-LAN
# address on :3000 (regex), so the app works from this machine and from other
# devices (phone) regardless of the machine's current IP — no per-IP edits.
LAN_ORIGIN_REGEX = (
    r"^http://("
    r"localhost|127\.0\.0\.1|"
    r"10\.\d{1,3}\.\d{1,3}\.\d{1,3}|"
    r"192\.168\.\d{1,3}\.\d{1,3}|"
    r"172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}"
    r"):3000$"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL],
    allow_origin_regex=LAN_ORIGIN_REGEX,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router, prefix="/auth", tags=["auth"])
app.include_router(audio_router, prefix="/audio", tags=["audio"])
app.include_router(playlist_router, prefix="/playlist", tags=["playlist"])
app.include_router(blend_router, prefix="/blend", tags=["blend"])
app.include_router(library_router, prefix="/library", tags=["library"])
app.include_router(users_router, prefix="/users", tags=["users"])
app.include_router(jam_router, prefix="/jam", tags=["jam"])

# Serve locally-stored uploads (e.g. playlist cover images) statically.
_UPLOADS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads")
os.makedirs(_UPLOADS_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=_UPLOADS_DIR), name="uploads")


@app.websocket("/ws/jam/{session_id}")
async def websocket_jam(websocket: WebSocket, session_id: int):
    # Authenticate + authorize (active session, room available) before accepting.
    auth = await jam_manager.authenticate(websocket, session_id)
    if not auth:
        await websocket.close(code=1008)  # policy violation
        return
    user, role = auth
    await websocket.accept()
    conn = JamConnection(websocket, user, role)
    await jam_manager.connect(conn, session_id)
    try:
        while True:
            data = await websocket.receive_json()
            await jam_manager.handle_event(conn, session_id, data)
    except WebSocketDisconnect:
        still_present = jam_manager.disconnect(conn, session_id)
        if conn.role == "host" and not jam_manager._host_present(session_id):
            # Host's socket dropped — give them a grace window to reconnect
            # (page refresh / navigation / blip) before ending for everyone.
            jam_manager.schedule_host_end(session_id)
        elif conn.role != "host" and not still_present:
            await jam_manager.broadcast(session_id, {
                "type": "participant_leave",
                "payload": {"userId": conn.user_id},
            })


async def _run_playlist_ws(websocket: WebSocket, playlist_id: int):
    # Authenticate + authorize via the auth cookie before accepting
    auth = await playlist_manager.authenticate(websocket, playlist_id)
    if not auth:
        await websocket.close(code=1008)  # policy violation
        return
    user, _playlist = auth
    await websocket.accept()
    conn = PlaylistConnection(websocket, user)
    await playlist_manager.connect(conn, playlist_id)
    try:
        while True:
            data = await websocket.receive_json()
            await playlist_manager.handle_event(conn, playlist_id, data)
    except WebSocketDisconnect:
        playlist_manager.disconnect(conn, playlist_id)
        await playlist_manager.broadcast(playlist_id, {
            "type": "presence",
            "payload": {"userId": conn.user_id, "state": "leave"},
        })


# Spec route (singular) + backwards-compatible alias (plural)
@app.websocket("/ws/playlist/{playlist_id}")
async def websocket_playlist_singular(websocket: WebSocket, playlist_id: int):
    await _run_playlist_ws(websocket, playlist_id)


@app.websocket("/ws/playlists/{playlist_id}")
async def websocket_playlist_plural(websocket: WebSocket, playlist_id: int):
    await _run_playlist_ws(websocket, playlist_id)

@app.on_event("startup")
async def startup_event():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    register_scheduler()

@app.get("/")
async def root():
    return {"status": "ok", "message": "zha API is running"}
