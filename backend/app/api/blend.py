from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from datetime import datetime, timedelta

from app.api.deps import get_current_user
from app.db.database import get_db
from app.models.user import User
from app.models.blend import Blend, BlendInvite
from app.models.play_history import PlayHistory

router = APIRouter()

MIN_PLAYS_REQUIRED = 10  # SRD 5.15: minimum 10 plays per user
LOOKBACK_DAYS = 30


async def _recent_video_ids(db: AsyncSession, user_id) -> set:
    """Distinct video_ids a user played in the last 30 days."""
    since = datetime.utcnow() - timedelta(days=LOOKBACK_DAYS)
    res = await db.execute(
        select(PlayHistory.video_id).where(
            PlayHistory.user_id == user_id,
            PlayHistory.played_at >= since,
        )
    )
    return {row[0] for row in res.all()}


def jaccard_similarity(a: set, b: set) -> float:
    """Jaccard index: |A intersection B| / |A union B|. 0.0 when both empty."""
    union = a | b
    if not union:
        return 0.0
    return len(a & b) / len(union)


async def compute_match(db: AsyncSession, user1_id, user2_id) -> dict:
    """Compute Blend match between two users from their listening history."""
    a = await _recent_video_ids(db, user1_id)
    b = await _recent_video_ids(db, user2_id)

    if len(a) < MIN_PLAYS_REQUIRED or len(b) < MIN_PLAYS_REQUIRED:
        return {
            "match_percentage": 0,
            "enough_data": False,
            "message": "Not enough listening data yet — keep listening!",
            "shared_track_ids": [],
        }

    score = jaccard_similarity(a, b)
    return {
        "match_percentage": round(score * 100),
        "enough_data": True,
        "message": None,
        "shared_track_ids": sorted(a & b),
    }


@router.post("/invite")
async def send_invite(to_user_id: str, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    if str(to_user_id) == str(current_user.id):
        raise HTTPException(status_code=400, detail="Cannot invite yourself")

    existing = await db.execute(
        select(BlendInvite).where(
            BlendInvite.from_user_id == current_user.id,
            BlendInvite.to_user_id == to_user_id,
            BlendInvite.status == "pending",
        )
    )
    if existing.scalars().first():
        raise HTTPException(status_code=400, detail="Invite already pending")

    invite = BlendInvite(
        from_user_id=current_user.id,
        to_user_id=to_user_id,
        status="pending",
        expires_at=datetime.utcnow() + timedelta(days=7),
    )
    db.add(invite)
    await db.commit()
    return {"message": "Invite sent"}


@router.post("/accept/{invite_id}")
async def accept_invite(invite_id: int, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    res = await db.execute(
        select(BlendInvite).where(BlendInvite.id == invite_id, BlendInvite.to_user_id == current_user.id)
    )
    invite = res.scalars().first()
    if not invite:
        raise HTTPException(status_code=404, detail="Invite not found")

    invite.status = "accepted"
    blend = Blend(user1_id=invite.from_user_id, user2_id=invite.to_user_id)
    db.add(blend)
    await db.commit()
    await db.refresh(blend)
    return {"message": "Blend created", "blend_id": blend.id}


@router.get("/list")
async def list_blends(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    res = await db.execute(
        select(Blend).where(or_(Blend.user1_id == current_user.id, Blend.user2_id == current_user.id))
    )
    blends = res.scalars().all()

    out = []
    for b in blends:
        partner_id = b.user2_id if b.user1_id == current_user.id else b.user1_id
        match = await compute_match(db, b.user1_id, b.user2_id)
        out.append({
            "id": b.id,
            "partner_id": str(partner_id),
            "created_at": b.created_at.isoformat() if b.created_at else None,
            "match_percentage": match["match_percentage"],
            "enough_data": match["enough_data"],
            "message": match["message"],
        })
    return out


@router.get("/{blend_id}")
async def get_blend(blend_id: int, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    res = await db.execute(
        select(Blend).where(
            Blend.id == blend_id,
            or_(Blend.user1_id == current_user.id, Blend.user2_id == current_user.id),
        )
    )
    blend = res.scalars().first()
    if not blend:
        raise HTTPException(status_code=404, detail="Blend not found")

    match = await compute_match(db, blend.user1_id, blend.user2_id)
    return {
        "id": blend.id,
        "user1_id": str(blend.user1_id),
        "user2_id": str(blend.user2_id),
        "created_at": blend.created_at.isoformat() if blend.created_at else None,
        **match,
    }
