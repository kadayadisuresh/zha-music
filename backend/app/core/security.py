from datetime import datetime, timedelta, timezone
import jwt
from typing import Optional, Any
from app.core.config import settings

ALGORITHM = "HS256"

def create_access_token(subject: str | Any, expires_delta: Optional[timedelta] = None) -> str:
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        # Default to 100 days as per task instructions
        expire = datetime.now(timezone.utc) + timedelta(days=100)
    
    to_encode = {"exp": expire, "sub": str(subject)}
    encoded_jwt = jwt.encode(to_encode, settings.JWT_SECRET, algorithm=ALGORITHM)
    return encoded_jwt

def verify_access_token(token: str) -> Optional[str]:
    try:
        decoded_data = jwt.decode(token, settings.JWT_SECRET, algorithms=[ALGORITHM])
        return decoded_data.get("sub")
    except jwt.PyJWTError:
        return None
