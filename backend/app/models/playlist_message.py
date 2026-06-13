import uuid
from sqlalchemy import Column, Integer, Text, String, ForeignKey, DateTime, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from app.models.base import Base


class PlaylistMessage(Base):
    __tablename__ = "playlist_messages"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    # playlists.id is an Integer PK (see migration 001)
    playlist_id = Column(
        Integer, ForeignKey("playlists.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    # Denormalized author identity so messages survive collaborator changes
    display_name = Column(String(200), nullable=True)
    avatar_url = Column(Text, nullable=True)
    text = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        Index("ix_playlist_messages_playlist_created", "playlist_id", "created_at"),
    )
