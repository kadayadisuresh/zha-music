from sqlalchemy import (
    Column, Integer, String, Boolean, ForeignKey, DateTime, UniqueConstraint
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.models.base import Base


class JamSession(Base):
    """A shared real-time listening session. The host controls playback;
    guests can add to the queue. Max 10 participants (enforced in the WS hub)."""
    __tablename__ = "jam_sessions"

    id = Column(Integer, primary_key=True, index=True)
    join_code = Column(String(8), unique=True, index=True, nullable=False)
    host_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    current_track_id = Column(String(32), nullable=True)
    current_position_ms = Column(Integer, nullable=False, server_default="0", default=0)
    is_playing = Column(Boolean, nullable=False, server_default="false", default=False)
    is_active = Column(Boolean, nullable=False, server_default="true", default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    participants = relationship(
        "JamParticipant", back_populates="session", cascade="all, delete-orphan"
    )


class JamParticipant(Base):
    __tablename__ = "jam_participants"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(
        Integer, ForeignKey("jam_sessions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    role = Column(String(10), nullable=False, default="guest")  # host | guest
    joined_at = Column(DateTime(timezone=True), server_default=func.now())

    session = relationship("JamSession", back_populates="participants")

    __table_args__ = (
        UniqueConstraint("session_id", "user_id", name="uq_jam_participant"),
    )


class JamInviteToken(Base):
    __tablename__ = "jam_invite_tokens"

    token = Column(String(64), primary_key=True)  # url-safe invite token
    session_id = Column(
        Integer, ForeignKey("jam_sessions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    expires_at = Column(DateTime(timezone=True), nullable=False)
