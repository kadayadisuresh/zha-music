from sqlalchemy import Column, Integer, String, ForeignKey, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from app.models.base import Base


class PlaylistInviteToken(Base):
    __tablename__ = "playlist_invite_tokens"

    token = Column(String(64), primary_key=True)  # 32-char urlsafe token
    playlist_id = Column(
        Integer, ForeignKey("playlists.id", ondelete="CASCADE"), nullable=False, index=True
    )
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    expires_at = Column(DateTime(timezone=True), nullable=False)
