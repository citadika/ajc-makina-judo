"""
Gestion des utilisateurs (réservée aux administrateurs). Equivalent
Python de UserController.java + UserManagementService.java.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.dependencies import get_db, require_admin
from app.exceptions import BadRequestException, ConflictException, ResourceNotFoundException
from app.models import User
from app.schemas import CreateUserRequest, UpdateUserRequest, UserSummary, serialize_permissions
from app.security import hash_password

router = APIRouter(prefix="/api/users", tags=["users"])

_ALLOWED_ROLES = {"ADMIN", "USER"}


def _check_role(role: str | None) -> None:
    if role is not None and role.upper() not in _ALLOWED_ROLES:
        raise BadRequestException(
            f"Rôle invalide : {role}. Rôles autorisés : ADMIN, USER."
        )


def _get_user_or_404(db: Session, user_id: int) -> User:
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise ResourceNotFoundException(f"Utilisateur introuvable : {user_id}")
    return user


@router.get("", response_model=list[UserSummary])
def list_users(
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> list[User]:

    return db.query(User).order_by(User.id).all()


@router.post("", response_model=UserSummary, status_code=201)
def create_user(
    request: CreateUserRequest,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> User:

    _check_role(request.role)

    if db.query(User).filter(User.username == request.username).first():
        raise ConflictException("Ce nom utilisateur est déjà pris.")

    if db.query(User).filter(User.email == request.email).first():
        raise ConflictException("Cette adresse email est déjà utilisée.")

    user = User(
        username=request.username,
        email=request.email,
        full_name=request.full_name,
        role=request.role.upper(),
        password_hash=hash_password(request.password),
        enabled=True,
        permissions=serialize_permissions(request.permissions),
    )

    db.add(user)
    db.commit()
    db.refresh(user)

    return user


@router.put("/{user_id}", response_model=UserSummary)
def update_user(
    user_id: int,
    request: UpdateUserRequest,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> User:

    _check_role(request.role)
    user = _get_user_or_404(db, user_id)

    if request.email and request.email != user.email:
        if db.query(User).filter(User.email == request.email).first():
            raise ConflictException("Cette adresse email est déjà utilisée.")
        user.email = request.email

    if request.full_name is not None:
        user.full_name = request.full_name

    if request.role:
        user.role = request.role.upper()

    if request.password:
        user.password_hash = hash_password(request.password)

    if request.permissions is not None:
        user.permissions = serialize_permissions(request.permissions)

    db.commit()
    db.refresh(user)

    return user


@router.put("/{user_id}/enable", response_model=UserSummary)
def enable_user(
    user_id: int,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> User:

    user = _get_user_or_404(db, user_id)
    user.enabled = True
    db.commit()
    db.refresh(user)
    return user


@router.put("/{user_id}/disable", response_model=UserSummary)
def disable_user(
    user_id: int,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> User:

    user = _get_user_or_404(db, user_id)
    user.enabled = False
    db.commit()
    db.refresh(user)
    return user
