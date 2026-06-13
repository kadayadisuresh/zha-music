from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from app.core.config import settings

engine = create_async_engine(
    settings.DATABASE_URL,
    echo=False,
    # The DB is a remote Supabase pooler (session mode) capped at 15 total
    # clients. The SQLAlchemy default (pool_size=5 + max_overflow=10 = 15) leaves
    # zero headroom, so transient/lingering connections push it over the limit and
    # requests fail with "max clients reached" (EMAXCONNSESSION) → 500 → the
    # browser reports "Failed to fetch". Bound the pool well under 15.
    pool_size=5,
    max_overflow=5,       # hard cap of 10 concurrent connections (5 headroom)
    pool_timeout=30,      # wait for a free connection instead of erroring under burst
    pool_pre_ping=True,   # check the connection is alive before use; reconnect if the pooler dropped it
    pool_recycle=300,     # proactively recycle connections older than 5 minutes
)
AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False
)

async def get_db():
    async with AsyncSessionLocal() as session:
        yield session
