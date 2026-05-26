import logging
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from app.db.session import SessionLocal
from app.models.blend import Blend
# Import other necessary models or services for blend calculation

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def recompute_blends():
    logger.info("Starting daily blend recomputation job")
    db = SessionLocal()
    try:
        blends = db.query(Blend).all()
        for blend in blends:
            # Recompute logic here
            logger.info(f"Recomputing blend {blend.id}")
    except Exception as e:
        logger.error(f"Error recomputing blends: {e}")
    finally:
        db.close()
    logger.info("Finished daily blend recomputation job")

def register_scheduler():
    scheduler = AsyncIOScheduler()
    # Schedule to run every day at 00:00 UTC
    scheduler.add_job(recompute_blends, 'cron', hour=0, minute=0)
    scheduler.start()
    return scheduler
