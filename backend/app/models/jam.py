from sqlalchemy import Column, Integer, String, ForeignKey
from sqlalchemy.orm import relationship
from app.models.base import Base

class JamSession(Base):
    __tablename__ = "jam_sessions"
    
    id = Column(Integer, primary_key=True, index=True)
    join_code = Column(String(8), unique=True, index=True, nullable=False)
    host_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    host = relationship("User", foreign_keys=[host_id])
    participants = relationship("JamParticipant", back_populates="session", cascade="all, delete-orphan")

class JamParticipant(Base):
    __tablename__ = "jam_participants"
    
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("jam_sessions.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    role = Column(String(10), nullable=False) # 'host' or 'guest'
    
    session = relationship("JamSession", back_populates="participants")
    user = relationship("User", foreign_keys=[user_id])
