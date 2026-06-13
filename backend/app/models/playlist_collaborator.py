import uuid
from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from app.models.base import Base


class PlaylistCollaborator(Base):
    __tablename__ = "playlist_collaborators"

    id = Column(Integer, primary_key=True)
    playlist_id = Column(
        Integer, ForeignKey("playlists.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    role = Column(String(20), nullable=False, default="editor")  # owner | editor | viewer
    joined_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        UniqueConstraint("playlist_id", "user_id", name="uq_playlist_collaborator"),
    )
