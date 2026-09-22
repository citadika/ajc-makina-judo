"""
Cartes de membre. Equivalent Python de CardController.java +
CardService.java.
"""

import random

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session, joinedload

from app.activity import log_activity
from app.dependencies import get_current_user, get_db, require_permission
from app.exceptions import ConflictException, ResourceNotFoundException
from app.models import Card, Member, User
from app.schemas import CardOut
from app.utils.qrcode_gen import build_qr_content, generate_qr_code

router = APIRouter(prefix="/api/cards", tags=["cards"])


def _generate_card_number(db: Session, member: Member) -> str:
    """Génère le matricule/numéro de carte au format demandé par le
    club : AJC + les 2 derniers chiffres de l'année de naissance +
    la 1ère lettre du prénom + la 1ère lettre du nom + le mois de
    naissance sur 2 chiffres + 2 chiffres aléatoires (pour garantir
    l'unicité en cas d'homonymes nés le même mois/année).

    Exemple : Jean KABILA, né le 15/03/2005 -> AJC05JK03<xx>
    """

    birth = member.birth_date
    yy = f"{birth.year % 100:02d}" if birth else "00"
    mm = f"{birth.month:02d}" if birth else "00"

    first_initial = (member.first_name or "").strip()[:1].upper() or "X"
    last_initial = (member.last_name or "").strip()[:1].upper() or "X"

    base = f"AJC{yy}{first_initial}{last_initial}{mm}"

    for _ in range(100):
        suffix = f"{random.randint(0, 99):02d}"
        candidate = f"{base}{suffix}"
        if db.query(Card).filter(Card.card_number == candidate).first() is None:
            return candidate

    raise ConflictException(
        "Impossible de générer un matricule unique pour cette carte, réessayez."
    )


@router.post("/member/{member_id}", response_model=CardOut, status_code=201)
def create_card(
    member_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _perm: User = Depends(require_permission("cards:create")),
) -> Card:

    member = db.query(Member).filter(Member.id == member_id).first()

    if member is None:
        raise ResourceNotFoundException(f"Adhérent introuvable : {member_id}")

    if db.query(Card).filter(Card.member_id == member_id).first() is not None:
        raise ConflictException("Cet adhérent possède déjà une carte.")

    card_number = _generate_card_number(db, member)

    # Si l'adhérent est désactivé au moment de la création (cas rare),
    # la carte naît directement désactivée plutôt que "ACTIVE".
    card = Card(
        card_number=card_number,
        member_id=member_id,
        status="ACTIVE" if member.active else "DISABLED",
        created_by_username=current_user.username,
    )

    qr_content = build_qr_content(card, member)
    card.qr_code = generate_qr_code(qr_content)

    db.add(card)
    log_activity(
        db,
        current_user.username,
        "card_created",
        f"Carte créée : {card_number} ({member.first_name} {member.last_name})",
    )
    db.commit()
    db.refresh(card)

    return card


@router.post("/{card_id}/qrcode", response_model=CardOut)
def regenerate_qr_code(
    card_id: int,
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
    _perm: User = Depends(require_permission("cards:update")),
) -> Card:

    card = (
        db.query(Card)
        .options(joinedload(Card.member))
        .filter(Card.id == card_id)
        .first()
    )

    if card is None:
        raise ResourceNotFoundException(f"Carte introuvable : {card_id}")

    if card.member is None:
        raise ResourceNotFoundException(
            f"Aucun adhérent associé à la carte : {card_id}"
        )

    qr_content = build_qr_content(card, card.member)
    card.qr_code = generate_qr_code(qr_content)

    db.commit()
    db.refresh(card)

    return card


@router.get("", response_model=list[CardOut])
def list_cards(
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
    _perm: User = Depends(require_permission("cards:read")),
) -> list[Card]:

    # joinedload (JOIN FETCH) : évite le problème N+1 décrit dans le
    # backend Java d'origine (CardRepository.findAllWithMember()).
    return db.query(Card).options(joinedload(Card.member)).order_by(Card.id).all()


@router.get("/{card_id}", response_model=CardOut)
def get_card(
    card_id: int,
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
    _perm: User = Depends(require_permission("cards:read")),
) -> Card:

    card = (
        db.query(Card)
        .options(joinedload(Card.member))
        .filter(Card.id == card_id)
        .first()
    )

    if card is None:
        raise ResourceNotFoundException(f"Carte introuvable : {card_id}")

    return card


@router.get("/member/{member_id}", response_model=CardOut)
def get_card_by_member(
    member_id: int,
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
    _perm: User = Depends(require_permission("cards:read")),
) -> Card:

    card = (
        db.query(Card)
        .options(joinedload(Card.member))
        .filter(Card.member_id == member_id)
        .first()
    )

    if card is None:
        raise ResourceNotFoundException(
            f"Aucune carte trouvée pour l'adhérent : {member_id}"
        )

    return card
