from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field, AliasChoices

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    DATABASE_URL: str = "postgresql+asyncpg://user:pass@localhost:5432/zha"
    FRONTEND_URL: str = "http://localhost:3000"
    JWT_SECRET: str = "supersecret"
    
    GOOGLE_CLIENT_ID: str = Field("", validation_alias=AliasChoices("GOOGLE_CLIENT_ID", "NEXT_PUBLIC_GOOGLE_CLIENT_ID"))
    GOOGLE_CLIENT_SECRET: str = ""
    GOOGLE_REDIRECT_URI: str = "http://localhost:8000/auth/google/callback"

settings = Settings()
