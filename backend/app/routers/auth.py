"""
Authentification. Equivalent Python de AuthController.java +
AuthService.java.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.dependencies import get_current_user, get_db
from app.exceptions import ForbiddenException, UnauthorizedException
from app.models import User
from app.schemas import LoginRequest, LoginResponse, MeResponse, parse_permissions
from app.security import create_access_token, verify_password

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login", response_model=LoginResponse)
def login(request: LoginRequest, db: Session = Depends(get_db)) -> LoginResponse:

    user = (
        db.query(User)
        .filter(
            (User.username == request.username) | (User.email == request.username)
        )
        .first()
    )

    if user is None or not verify_password(request.password, user.password_hash):
        raise UnauthorizedException("Identifiant ou mot de passe incorrect.")

    if not user.enabled:
        raise ForbiddenException("Ce compte est désactivé.")

    token = create_access_token(
        username=user.username, user_id=user.id, email=user.email, role=user.role
    )

    return LoginResponse(
        message="Connexion réussie",
        token=token,
        user_id=user.id,
        username=user.username,
        email=user.email,
        full_name=user.full_name,
        role=user.role,
        permissions=parse_permissions(user.permissions),
    )


@router.get("/me", response_model=MeResponse)
def me(current_user: User = Depends(get_current_user)) -> MeResponse:

    return MeResponse(
        user_id=current_user.id,
        username=current_user.username,
        email=current_user.email,
        full_name=current_user.full_name,
        role=current_user.role,
        permissions=parse_permissions(current_user.permissions),
    )
