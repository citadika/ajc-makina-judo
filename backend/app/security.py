"""
Hachage de mot de passe (bcrypt) + émission/validation de JWT.

Equivalent Python de JwtService.java + BCryptPasswordEncoder côté
Java. Même structure de claims (sub=username, userId, email, role),
même durée de validité (24h).
"""

from datetime import datetime, timedelta, timezone

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.config import settings

_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(plain_password: str) -> str:
    return _pwd_context.hash(plain_password)


def verify_password(plain_password: str, password_hash: str) -> bool:
    return _pwd_context.verify(plain_password, password_hash)


def create_access_token(
    *, username: str, user_id: int, email: str, role: str
) -> str:
    now = datetime.now(timezone.utc)
    expiration = now + timedelta(hours=settings.jwt_expiration_hours)

    claims = {
        "sub": username,
        "userId": user_id,
        "email": email,
        "role": role,
        "iat": int(now.timestamp()),
        "exp": expiration,
    }

    return jwt.encode(claims, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> dict | None:
    try:
        return jwt.decode(
            token, settings.jwt_secret, algorithms=[settings.jwt_algorithm]
        )
    except JWTError:
        return None
