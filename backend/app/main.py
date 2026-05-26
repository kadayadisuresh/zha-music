from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.api.auth import router as auth_router
from app.api.audio import router as audio_router
from app.api.playlist import router as playlist_router

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

@app.get("/")
async def root():
    return {"status": "ok", "message": "zha API is running"}
