from sqlalchemy import Column, String, ForeignKey, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from app.models.base import Base

class LikedAlbum(Base):
    __tablename__ = "liked_albums"
    
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), primary_key=True)
    album_id = Column(String(64), primary_key=True, index=True)
    title = Column(String(500), nullable=False)
    artist_name = Column(String(500), nullable=False)
    thumbnail_url = Column(String, nullable=True)
    liked_at = Column(DateTime(timezone=True), server_default=func.now())
