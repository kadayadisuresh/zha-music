from sqlalchemy import Column, String, ForeignKey, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from app.models.base import Base

class FollowedArtist(Base):
    __tablename__ = "followed_artists"
    
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), primary_key=True)
    channel_id = Column(String(64), primary_key=True, index=True)
    name = Column(String(500), nullable=False)
    thumbnail_url = Column(String, nullable=True)
    followed_at = Column(DateTime(timezone=True), server_default=func.now())
