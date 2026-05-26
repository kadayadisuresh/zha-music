from sqlalchemy import Column, String, DateTime, JSON
from sqlalchemy.sql import func
from app.models.base import Base

class CacheEntry(Base):
    __tablename__ = "cache_entries"
    
    key = Column(String, primary_key=True)
    data = Column(JSON, nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
