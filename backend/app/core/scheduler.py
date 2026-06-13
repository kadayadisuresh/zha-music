import logging
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from app.db.database import AsyncSessionLocal
from app.models.blend import Blend
from sqlalchemy import select

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def recompute_blends():
    logger.info("Starting daily blend recomputation job")
    async with AsyncSessionLocal() as db:
        try:
            # Imported here to avoid a circular import at module load time
            from app.api.blend import compute_match
            result = await db.execute(select(Blend))
            blends = result.scalars().all()
            for blend in blends:
                match = await compute_match(db, blend.user1_id, blend.user2_id)
                logger.info(
                    f"Blend {blend.id}: match={match['match_percentage']}% "
                    f"(enough_data={match['enough_data']})"
                )
            await db.commit()
        except Exception as e:
            logger.error(f"Error recomputing blends: {e}")
    logger.info("Finished daily blend recomputation job")

def register_scheduler():
    scheduler = AsyncIOScheduler()
    # Schedule to run every day at 00:00 UTC
    scheduler.add_job(recompute_blends, 'cron', hour=0, minute=0)
    scheduler.start()
    return scheduler
