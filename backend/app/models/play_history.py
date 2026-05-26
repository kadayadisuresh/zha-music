import uuid
from sqlalchemy import Column, String, ForeignKey, Integer, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from app.models.base import Base

class PlayHistory(Base):
    __tablename__ = "play_history"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    video_id = Column(String(16), nullable=False, index=True)
    title = Column(String(500), nullable=False)
    artist = Column(String(500), nullable=False)
    thumbnail_url = Column(String, nullable=True)
    played_at = Column(DateTime(timezone=True), server_default=func.now())
    play_duration_seconds = Column(Integer, nullable=False)
