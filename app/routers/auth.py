from fastapi import APIRouter, Depends, HTTPException, Response, Request, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User
from app.schemas import UserRegister, UserLogin, TokenResponse, MessageResponse
from app.auth import (
    hash_password, verify_password,
    create_access_token, create_refresh_token,
    decode_refresh_token, get_current_user
)
from app.middleware.rate_limiter import login_rate_limit, register_rate_limit

router = APIRouter(prefix="/auth", tags=["Authentication"])

COOKIE_NAME = "refresh_token"
COOKIE_MAX_AGE = 7 * 24 * 60 * 60  # 7 days in seconds


def set_refresh_cookie(response: Response, token: str):
    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        httponly=True,
        secure=True,
        samesite="none",
        max_age=COOKIE_MAX_AGE,
        path="/api/v1/auth"
    )


def clear_refresh_cookie(response: Response):
    response.delete_cookie(
        key=COOKIE_NAME,
        path="/api/v1/auth"
    )


@router.post("/register", response_model=MessageResponse, status_code=status.HTTP_201_CREATED)
async def register(
    data: UserRegister,
    db: Session = Depends(get_db),
    _rate_limit=Depends(register_rate_limit)
):
    # Check if email already exists
    existing = db.query(User).filter(User.email == data.email).first()
    if existing:
        raise HTTPException(status_code=409, detail="Email already registered")

    user = User(
        email=data.email,
        password_hash=hash_password(data.password),
        role="customer"
    )
    db.add(user)
    db.commit()
    return {"message": "Account created successfully"}


@router.post("/login", response_model=TokenResponse)
async def login(
    data: UserLogin,
    response: Response,
    db: Session = Depends(get_db),
    _rate_limit=Depends(login_rate_limit)
):
    user = db.query(User).filter(User.email == data.email).first()
    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    access_token = create_access_token(user.id, user.role)
    refresh_token = create_refresh_token(user.id)

    set_refresh_cookie(response, refresh_token)

    return {"access_token": access_token, "token_type": "bearer"}


@router.post("/refresh", response_model=TokenResponse)
async def refresh(request: Request, db: Session = Depends(get_db)):
    token = request.cookies.get(COOKIE_NAME)
    if not token:
        raise HTTPException(status_code=401, detail="No refresh token")

    payload = decode_refresh_token(token)
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    import uuid
    user = db.query(User).filter(User.id == uuid.UUID(user_id)).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    access_token = create_access_token(user.id, user.role)
    return {"access_token": access_token, "token_type": "bearer"}


@router.post("/logout", response_model=MessageResponse)
async def logout(response: Response):
    clear_refresh_cookie(response)
    return {"message": "Logged out successfully"}
