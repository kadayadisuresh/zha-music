import secrets
import urllib.parse
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
import httpx

from app.core.config import settings
from app.db.database import get_db
from app.models.user import User
from app.core.security import create_access_token
from app.api.deps import get_current_user

router = APIRouter()

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo"

REDIRECT_URI = "http://localhost:8000/auth/google/callback"

@router.get("/google")
async def login_google():
    state = secrets.token_urlsafe(32)
    params = {
        "client_id": settings.GOOGLE_CLIENT_ID,
        "redirect_uri": REDIRECT_URI,
        "response_type": "code",
        "scope": "openid email profile",
        "state": state,
        "access_type": "offline",
        "prompt": "consent"
    }
    url = f"{GOOGLE_AUTH_URL}?{urllib.parse.urlencode(params)}"
    
    redirect_response = RedirectResponse(url=url)
    redirect_response.set_cookie(
        key="oauth_state",
        value=state,
        httponly=True,
        secure=True, # In development this usually needs to be false if not HTTPS, but following instructions
        samesite="lax",
        max_age=600 # 10 mins
    )
    return redirect_response

@router.get("/google/callback")
async def google_callback(request: Request, code: str, state: str, db: AsyncSession = Depends(get_db)):
    original_state = request.cookies.get("oauth_state")
    if not original_state or original_state != state:
        raise HTTPException(status_code=400, detail="Invalid state parameter")

    # Exchange code for token
    token_data = {
        "client_id": settings.GOOGLE_CLIENT_ID,
        "client_secret": settings.GOOGLE_CLIENT_SECRET,
        "code": code,
        "redirect_uri": REDIRECT_URI,
        "grant_type": "authorization_code"
    }
    
    async with httpx.AsyncClient() as client:
        token_res = await client.post(GOOGLE_TOKEN_URL, data=token_data)
        if token_res.status_code != 200:
            raise HTTPException(status_code=400, detail="Failed to exchange code for token")
            
        access_token = token_res.json().get("access_token")
        
        # Get user info
        headers = {"Authorization": f"Bearer {access_token}"}
        user_res = await client.get(GOOGLE_USERINFO_URL, headers=headers)
        if user_res.status_code != 200:
            raise HTTPException(status_code=400, detail="Failed to fetch user info")
            
        user_info = user_res.json()
        
    email = user_info.get("email")
    google_id = user_info.get("sub")
    name = user_info.get("name")
    picture = user_info.get("picture")
    
    if not email:
        raise HTTPException(status_code=400, detail="Email not provided by Google")
        
    # Create or update user
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalars().first()
    
    if user:
        user.google_id = google_id
        user.display_name = name
        user.avatar_url = picture
    else:
        user = User(
            email=email,
            google_id=google_id,
            display_name=name,
            avatar_url=picture
        )
        db.add(user)
        
    await db.commit()
    await db.refresh(user)
    
    # Generate JWT
    jwt_token = create_access_token(subject=str(user.id))
    
    # Determine redirect URL
    return_to = request.cookies.get("oauth_return_to")
    frontend_redirect_url = settings.FRONTEND_URL
    if return_to and return_to.startswith("/"):
        frontend_redirect_url = f"{settings.FRONTEND_URL.rstrip('/')}{return_to}"

    # Redirect to frontend
    response = RedirectResponse(url=frontend_redirect_url)
    response.set_cookie(
        key="access_token",
        value=jwt_token,
        httponly=True,
        secure=True,
        samesite="strict"
    )
    # Delete the cookies
    response.delete_cookie("oauth_state")
    response.delete_cookie("oauth_return_to")
    return response

@router.get("/me")
async def get_me(current_user: User = Depends(get_current_user)):
    return {
        "id": str(current_user.id),
        "email": current_user.email,
        "display_name": current_user.display_name,
        "avatar_url": current_user.avatar_url,
        "crossfade_seconds": current_user.crossfade_seconds,
        "autoplay_enabled": current_user.autoplay_enabled
    }

@router.delete("/session")
async def logout():
    response = Response(status_code=200, content='{"message": "Logged out successfully"}', media_type="application/json")
    response.delete_cookie(
        key="access_token",
        httponly=True,
        secure=True,
        samesite="strict"
    )
    return response