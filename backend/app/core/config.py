from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+asyncpg://user:pass@localhost:5432/zha"
    FRONTEND_URL: str = "http://localhost:3000"
    JWT_SECRET: str = "supersecret"
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""
    
    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()
