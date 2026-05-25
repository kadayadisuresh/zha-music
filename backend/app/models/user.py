import uuid
from sqlalchemy import Column, String, Boolean, SmallInteger, Text, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from .base import Base

class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    google_id = Column(String(128), unique=True, index=True)
    email = Column(String(320), unique=True, index=True, nullable=False)
    display_name = Column(String(200))
    avatar_url = Column(Text)
    crossfade_seconds = Column(SmallInteger, default=0)
    autoplay_enabled = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    last_seen_at = Column(DateTime(timezone=True), nullable=True)
