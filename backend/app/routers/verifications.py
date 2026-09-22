"""
Vérification de carte. Equivalent Python de
VerificationController.java + VerificationService.java.
"""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session, joinedload

from app.activity import log_activity
from app.dependencies import get_current_user, get_db, require_permission
from app.exceptions import ResourceNotFoundException
from app.models import Card, User, VerificationLog
from app.schemas import CardOut, VerificationLogOut

router = APIRouter(prefix="/api/verifications", tags=["verifications"])


@router.get("/verify/{card_number}", response_model=CardOut)
def verify(
    card_number: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _perm: User = Depends(require_permission("verifications:create")),
) -> Card:

    card = (
        db.query(Card)
        .options(joinedload(Card.member))
        .filter(Card.card_number == card_number)
        .first()
    )

    log_entry = VerificationLog(
        card_number=card_number,
        found=card is not None,
        member_id=card.member_id if card is not None else None,
        verified_at=datetime.now(timezone.utc),
        verified_by_username=current_user.username,
    )

    db.add(log_entry)
    log_activity(
        db,
        current_user.username,
        "verification",
        f"Vérification de carte {card_number} : "
        + ("trouvée" if card is not None else "introuvable"),
    )
    db.commit()

    if card is None:
        raise ResourceNotFoundException(
            f"Aucune carte trouvée pour le numéro : {card_number}"
        )

    # Filet de sécurité : même si card.status n'a pas été synchronisé
    # (ex. adhérent désactivé avant l'ajout de cette règle), une carte
    # dont le titulaire est désactivé doit toujours ressortir comme
    # invalide lors d'une vérification.
    if card.member is not None and not card.member.active:
        card.status = "DISABLED"

    return card


@router.get("/recent", response_model=list[VerificationLogOut])
def get_recent(
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
    _perm: User = Depends(require_permission("verifications:read")),
) -> list[VerificationLog]:

    return (
        db.query(VerificationLog)
        .options(joinedload(VerificationLog.member))
        .order_by(VerificationLog.verified_at.desc())
        .limit(20)
        .all()
    )


@router.delete("/recent", status_code=204)
def clear_recent(
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
    _perm: User = Depends(require_permission("verifications:delete")),
) -> None:
    """Vide l'historique des vérifications récentes (bouton "Vider"
    de l'écran de vérification)."""

    db.query(VerificationLog).delete()
    db.commit()
