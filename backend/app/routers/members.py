"""
Adhérents (Members). Equivalent Python de MemberController.java +
MemberService.java.

Les routes de création/modification acceptent du multipart/form-data
avec deux parties : "member" (une chaîne JSON, validée avec
MemberCreate/MemberUpdate) et "photo" (fichier image, optionnel) -
exactement le même contrat que le backend Java d'origine
(@RequestPart("member") + @RequestPart("photo")).
"""

from fastapi import APIRouter, Depends, Form, UploadFile
from pydantic import ValidationError
from sqlalchemy.orm import Session

from app.activity import log_activity
from app.dependencies import get_current_user, get_db, require_permission
from app.exceptions import BadRequestException, ConflictException, ResourceNotFoundException
from app.models import Card, Member, User
from app.schemas import MemberCreate, MemberOut, MemberUpdate, compose_address
from app.utils.uploads import MEMBERS_DIR, delete_upload, save_upload

router = APIRouter(prefix="/api/members", tags=["members"])


def _parse_member_create(member_json: str) -> MemberCreate:
    try:
        return MemberCreate.model_validate_json(member_json)
    except ValidationError as exc:
        raise BadRequestException(f"Données adhérent invalides : {exc}")


def _parse_member_update(member_json: str) -> MemberUpdate:
    try:
        return MemberUpdate.model_validate_json(member_json)
    except ValidationError as exc:
        raise BadRequestException(f"Données adhérent invalides : {exc}")


@router.post("", response_model=MemberOut, status_code=201)
async def create_member(
    member: str = Form(...),
    photo: UploadFile | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _perm: User = Depends(require_permission("members:create")),
) -> Member:

    request = _parse_member_create(member)

    if request.phone and db.query(Member).filter(Member.phone == request.phone).first():
        raise ConflictException("Un membre existe déjà avec ce numéro de téléphone.")

    if request.email and db.query(Member).filter(Member.email == request.email).first():
        raise ConflictException("Un membre existe déjà avec cette adresse email.")

    photo_filename = await save_upload(photo, MEMBERS_DIR)

    new_member = Member(
        first_name=request.first_name,
        last_name=request.last_name,
        phone=request.phone,
        email=request.email,
        birth_date=request.birth_date,
        commune=request.commune,
        quartier=request.quartier,
        avenue=request.avenue,
        numero=request.numero,
        address=compose_address(request.commune, request.quartier, request.avenue, request.numero),
        sexe=request.sexe,
        belt=request.belt,
        photo=photo_filename,
        active=True,
        created_by_username=current_user.username,
        updated_by_username=current_user.username,
    )

    db.add(new_member)
    log_activity(
        db,
        current_user.username,
        "member_created",
        f"Adhérent créé : {request.first_name} {request.last_name}",
    )
    db.commit()
    db.refresh(new_member)

    return new_member


@router.get("", response_model=list[MemberOut])
def list_members(
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
    _perm: User = Depends(require_permission("members:read")),
) -> list[Member]:

    return db.query(Member).order_by(Member.id).all()


@router.get("/search", response_model=list[MemberOut])
def search_members(
    keyword: str | None = None,
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
    _perm: User = Depends(require_permission("members:read")),
) -> list[Member]:

    if not keyword or not keyword.strip():
        return db.query(Member).order_by(Member.id).all()

    like_pattern = f"%{keyword.strip()}%"

    return (
        db.query(Member)
        .filter(
            Member.first_name.ilike(like_pattern) | Member.last_name.ilike(like_pattern)
        )
        .order_by(Member.id)
        .all()
    )


def _get_member_or_404(db: Session, member_id: int) -> Member:
    member = db.query(Member).filter(Member.id == member_id).first()
    if member is None:
        raise ResourceNotFoundException(f"Adhérent introuvable : {member_id}")
    return member


@router.get("/{member_id}", response_model=MemberOut)
def get_member(
    member_id: int,
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
    _perm: User = Depends(require_permission("members:read")),
) -> Member:

    return _get_member_or_404(db, member_id)


@router.put("/{member_id}", response_model=MemberOut)
async def update_member(
    member_id: int,
    member: str = Form(...),
    photo: UploadFile | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _perm: User = Depends(require_permission("members:update")),
) -> Member:

    request = _parse_member_update(member)
    existing = _get_member_or_404(db, member_id)

    if (
        request.phone
        and request.phone != existing.phone
        and db.query(Member).filter(Member.phone == request.phone).first()
    ):
        raise ConflictException(
            "Un autre membre utilise déjà ce numéro de téléphone."
        )

    if (
        request.email
        and request.email != existing.email
        and db.query(Member).filter(Member.email == request.email).first()
    ):
        raise ConflictException("Un autre membre utilise déjà cette adresse email.")

    if request.first_name is not None:
        existing.first_name = request.first_name
    if request.last_name is not None:
        existing.last_name = request.last_name
    if request.phone is not None:
        existing.phone = request.phone
    if request.email is not None:
        existing.email = request.email
    if request.birth_date is not None:
        existing.birth_date = request.birth_date

    # Adresse : ne recalculer que si au moins un des 4 champs structurés
    # est présent dans la requête - sinon on laisse l'adresse existante
    # intacte (ex. un simple toggle actif/inactif n'envoie aucun de ces
    # champs et ne doit pas l'effacer).
    if any(v is not None for v in (request.commune, request.quartier, request.avenue, request.numero)):
        existing.commune = request.commune if request.commune is not None else existing.commune
        existing.quartier = request.quartier if request.quartier is not None else existing.quartier
        existing.avenue = request.avenue if request.avenue is not None else existing.avenue
        existing.numero = request.numero if request.numero is not None else existing.numero
        existing.address = compose_address(existing.commune, existing.quartier, existing.avenue, existing.numero)

    if request.sexe is not None:
        existing.sexe = request.sexe
    if request.belt is not None:
        existing.belt = request.belt
    if request.active is not None:
        existing.active = request.active

        # Un adhérent désactivé doit avoir une carte invalide lors de
        # la vérification : on garde card.status synchronisé avec
        # member.active plutôt que de ne toucher qu'au drapeau membre.
        existing_card = db.query(Card).filter(Card.member_id == existing.id).first()
        if existing_card is not None:
            existing_card.status = "ACTIVE" if existing.active else "DISABLED"

    if photo is not None and photo.filename:
        old_photo = existing.photo
        new_photo = await save_upload(photo, MEMBERS_DIR)
        if new_photo is not None:
            existing.photo = new_photo
            if old_photo:
                delete_upload(old_photo, MEMBERS_DIR)

    existing.updated_by_username = current_user.username
    log_activity(
        db,
        current_user.username,
        "member_updated",
        f"Adhérent modifié : {existing.first_name} {existing.last_name}",
    )

    db.commit()
    db.refresh(existing)

    return existing


@router.delete("/{member_id}", status_code=204)
def delete_member(
    member_id: int,
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
    _perm: User = Depends(require_permission("members:delete")),
) -> None:

    member = _get_member_or_404(db, member_id)

    if db.query(Card).filter(Card.member_id == member_id).first() is not None:
        raise ConflictException(
            "Impossible de supprimer cet adhérent car une carte lui est associée."
        )

    if member.photo:
        delete_upload(member.photo, MEMBERS_DIR)

    db.delete(member)
    db.commit()
