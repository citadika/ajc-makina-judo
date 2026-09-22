"""
Historique des ceintures. Equivalent Python de
BeltHistoryController.java + BeltHistoryService.java.
"""

from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.dependencies import get_current_user, get_db, require_permission
from app.exceptions import BadRequestException, ResourceNotFoundException
from app.models import BeltHistory, Member, User
from app.routers.examiners import upsert_examiner
from app.schemas import BeltHistoryOut, PromoteBeltRequest, UpdateBeltHistoryRequest

router = APIRouter(prefix="/api/members/{member_id}/belt-history", tags=["belt-history"])


def _get_member_or_404(db: Session, member_id: int) -> Member:
    member = db.query(Member).filter(Member.id == member_id).first()
    if member is None:
        raise ResourceNotFoundException(f"Adhérent introuvable : {member_id}")
    return member


@router.post("", response_model=BeltHistoryOut, status_code=201)
def promote(
    member_id: int,
    request: PromoteBeltRequest,
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
    _perm: User = Depends(require_permission("belt_history:create")),
) -> BeltHistory:

    member = _get_member_or_404(db, member_id)

    ancienne_ceinture = member.belt
    nouvelle_ceinture = request.nouvelle_ceinture

    if nouvelle_ceinture == ancienne_ceinture:
        raise BadRequestException(
            "La nouvelle ceinture doit être différente de la ceinture actuelle."
        )

    entry = BeltHistory(
        member_id=member.id,
        ancienne_ceinture=ancienne_ceinture,
        nouvelle_ceinture=nouvelle_ceinture,
        # Facultatif côté client : par défaut, la date du jour.
        date_passage=request.date_passage or date.today(),
        observation=request.observation,
        examinateur=request.examinateur,
        examinateur2=request.examinateur2,
        examinateur3=request.examinateur3,
    )

    member.belt = nouvelle_ceinture

    # Tout nom (et grade) d'examinateur saisi ici alimente aussi la
    # liste réutilisable (auto-complétion), même sans clic sur "Ajouter".
    for name, grade in (
        (request.examinateur, request.examinateur_grade),
        (request.examinateur2, request.examinateur2_grade),
        (request.examinateur3, request.examinateur3_grade),
    ):
        upsert_examiner(db, name, _current_user.username, grade)

    db.add(entry)
    db.commit()
    db.refresh(entry)

    return entry


@router.get("", response_model=list[BeltHistoryOut])
def get_history(
    member_id: int,
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
    _perm: User = Depends(require_permission("belt_history:read")),
) -> list[BeltHistory]:

    _get_member_or_404(db, member_id)

    return (
        db.query(BeltHistory)
        .filter(BeltHistory.member_id == member_id)
        .order_by(BeltHistory.date_passage.desc(), BeltHistory.id.desc())
        .all()
    )


@router.patch("/{history_id}", response_model=BeltHistoryOut)
def update_history_entry(
    member_id: int,
    history_id: int,
    request: UpdateBeltHistoryRequest,
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
    _perm: User = Depends(require_permission("belt_history:update")),
) -> BeltHistory:
    """Corrige la date (et éventuellement l'observation / le nom de
    l'examinateur) d'un passage de ceinture déjà enregistré - la date
    du passage doit rester modifiable après coup."""

    _get_member_or_404(db, member_id)

    entry = (
        db.query(BeltHistory)
        .filter(BeltHistory.id == history_id, BeltHistory.member_id == member_id)
        .first()
    )

    if entry is None:
        raise ResourceNotFoundException(
            f"Entrée d'historique introuvable : {history_id}"
        )

    entry.date_passage = request.date_passage
    if request.observation is not None:
        entry.observation = request.observation
    # Contrairement à `observation`, ces 3 champs sont toujours envoyés
    # par la modale d'édition (même vides pour effacer un examinateur) :
    # affectation directe, pas de "si fourni" qui empêcherait de vider
    # un examinateur déjà enregistré.
    entry.examinateur = request.examinateur
    entry.examinateur2 = request.examinateur2
    entry.examinateur3 = request.examinateur3

    for name, grade in (
        (request.examinateur, request.examinateur_grade),
        (request.examinateur2, request.examinateur2_grade),
        (request.examinateur3, request.examinateur3_grade),
    ):
        upsert_examiner(db, name, _current_user.username, grade)

    db.commit()
    db.refresh(entry)

    return entry
