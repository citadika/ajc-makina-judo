"""
Dépendances FastAPI : session base de données, utilisateur courant,
contrôle du rôle ADMIN.

Equivalent Python de JwtAuthenticationFilter.java + SecurityConfig
(règles @PreAuthorize("hasRole('ADMIN')")).
"""

from typing import Callable

from fastapi import Depends, Request
from sqlalchemy.orm import Session

from app.database import get_db
from app.exceptions import ForbiddenException, UnauthorizedException
from app.models import User
from app.schemas import parse_permissions
from app.security import decode_access_token

__all__ = ["get_db", "get_current_user", "require_admin", "require_permission"]


def get_current_user(
    request: Request,
    db: Session = Depends(get_db),
) -> User:

    authorization = request.headers.get("Authorization")

    if not authorization or not authorization.startswith("Bearer "):
        raise UnauthorizedException("Authentification requise.")

    token = authorization[len("Bearer ") :]

    payload = decode_access_token(token)

    if payload is None:
        raise UnauthorizedException("Session invalide ou expirée.")

    username = payload.get("sub")

    user = db.query(User).filter(User.username == username).first()

    if user is None:
        raise UnauthorizedException("Session invalide ou expirée.")

    if not user.enabled:
        raise ForbiddenException("Ce compte est désactivé.")

    return user


def require_admin(user: User = Depends(get_current_user)) -> User:

    if user.role != "ADMIN":
        raise ForbiddenException(
            "Cette action est réservée aux administrateurs."
        )

    return user


def require_permission(key: str) -> Callable[[User], User]:
    """Fabrique une dépendance FastAPI qui vérifie qu'un utilisateur
    est autorisé à effectuer une action donnée (voir
    app/schemas.py, PERMISSION_KEYS).

    Un compte ADMIN passe toujours (accès complet), quel que soit le
    contenu de sa liste d'autorisations. Un compte USER doit avoir la
    clé `key` dans sa liste d'autorisations, accordée par un
    administrateur lors de la création/modification de son compte
    (voir app/routers/users.py).
    """

    def _check(user: User = Depends(get_current_user)) -> User:

        if user.role == "ADMIN":
            return user

        if key not in parse_permissions(user.permissions):
            raise ForbiddenException(
                "Cette action n'est pas autorisée pour votre compte. "
                "Contactez un administrateur pour obtenir les droits nécessaires."
            )

        return user

    return _check
