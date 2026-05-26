from sqlalchemy import Column, Integer, String, Float
from .base import Base

class LyricsSyncOffset(Base):
    __tablename__ = "lyrics_sync_offset"
    
    id = Column(Integer, primary_key=True, index=True)
    video_id = Column(String, unique=True, index=True, nullable=False)
    offset_seconds = Column(Float, default=0.0)
