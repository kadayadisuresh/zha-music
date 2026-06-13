from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Boolean
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.models.base import Base

class Playlist(Base):
    __tablename__ = "playlists"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    description = Column(String, nullable=True)
    cover_url = Column(String, nullable=True)  # public URL of the cover image
    # users.id is UUID — match it (the Alembic migration already uses UUID here)
    owner_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    
    # Collaborative fields
    is_collaborative = Column(Boolean, default=False)
    invite_token = Column(String, index=True, nullable=True)
    invite_token_expires_at = Column(DateTime, nullable=True)
    
    owner = relationship("User", back_populates="playlists")
    songs = relationship("PlaylistSong", back_populates="playlist", cascade="all, delete-orphan")

class PlaylistSong(Base):
    __tablename__ = "playlist_songs"
    id = Column(Integer, primary_key=True, index=True)
    playlist_id = Column(Integer, ForeignKey("playlists.id"), nullable=False)
    song_id = Column(String, nullable=False) # Store YouTube/Source ID
    position = Column(Integer, nullable=False) # Used for ordering
    version = Column(Integer, default=1)
    created_at = Column(DateTime, server_default=func.now())
    
    playlist = relationship("Playlist", back_populates="songs")
