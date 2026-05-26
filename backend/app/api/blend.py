from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.api.auth import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.models.blend import Blend, BlendInvite
from datetime import datetime, timedelta

router = APIRouter()

@router.post("/invite")
async def send_invite(to_user_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if to_user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot invite yourself")
    
    # Check if invite exists
    existing = db.query(BlendInvite).filter(
        BlendInvite.from_user_id == current_user.id,
        BlendInvite.to_user_id == to_user_id,
        BlendInvite.status == "pending"
    ).first()
    
    if existing:
        raise HTTPException(status_code=400, detail="Invite already pending")
    
    invite = BlendInvite(
        from_user_id=current_user.id,
        to_user_id=to_user_id,
        status="pending",
        expires_at=datetime.utcnow() + timedelta(days=7)
    )
    db.add(invite)
    db.commit()
    return {"message": "Invite sent"}

@router.post("/accept/{invite_id}")
async def accept_invite(invite_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    invite = db.query(BlendInvite).filter(BlendInvite.id == invite_id, BlendInvite.to_user_id == current_user.id).first()
    if not invite:
        raise HTTPException(status_code=404, detail="Invite not found")
    
    invite.status = "accepted"
    
    # Create blend
    blend = Blend(user1_id=invite.from_user_id, user2_id=invite.to_user_id)
    db.add(blend)
    db.commit()
    return {"message": "Blend created"}

@router.get("/list")
async def list_blends(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    blends = db.query(Blend).filter((Blend.user1_id == current_user.id) | (Blend.user2_id == current_user.id)).all()
    return blends
