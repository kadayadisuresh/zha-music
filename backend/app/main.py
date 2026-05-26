from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.api.auth import router as auth_router
from app.api.audio import router as audio_router
from app.api.playlist import router as playlist_router
from app.api.blend import router as blend_router
from app.api.jam import jam_manager
from app.core.scheduler import register_scheduler
from fastapi import WebSocket, WebSocketDisconnect, Depends
from app.api.deps import get_current_user

app = FastAPI(title="zha API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router, prefix="/auth", tags=["auth"])
app.include_router(audio_router, prefix="/audio", tags=["audio"])
app.include_router(playlist_router, prefix="/playlist", tags=["playlist"])
app.include_router(blend_router, prefix="/blend", tags=["blend"])

@app.websocket("/ws/jam/{session_code}")
async def websocket_jam(
    websocket: WebSocket,
    session_code: str,
    # current_user = Depends(get_current_user) # Authentication would be added here
):
    await jam_manager.connect(websocket, session_code)
    try:
        while True:
            data = await websocket.receive_json()
            await jam_manager.handle_event(websocket, session_code, data)
    except WebSocketDisconnect:
        jam_manager.disconnect(websocket, session_code)

@app.on_event("startup")
async def startup_event():
    register_scheduler()

@app.get("/")
async def root():
    return {"status": "ok", "message": "zha API is running"}
