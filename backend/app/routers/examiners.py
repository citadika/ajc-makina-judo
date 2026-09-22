"""
Liste réutilisable des examinateurs (voir app/models.py, Examiner).

GET est soumis à la permission "belt_history:read" (même ressource
que l'historique des ceintures, puisque cette liste sert à
l'auto-complétion du formulaire de passage). POST ("Ajouter") est
réservé aux comptes autorisés à enregistrer des passages de ceinture
(permission "belt_history:create", voir app/dependencies.py) - un
compte ADMIN passe toujours.
"""

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.dependencies import get_current_user, get_db, require_permission
from app.exceptions import BadRequestException
from app.models import Examiner, User
from app.schemas import CreateExaminerRequest, ExaminerOut

router = APIRouter(prefix="/api/examiners", tags=["examiners"])


@router.get("", response_model=list[ExaminerOut])
def list_examiners(
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
    _perm: User = Depends(require_permission("belt_history:read")),
) -> list[Examiner]:

    return db.query(Examiner).order_by(Examiner.name).all()


@router.post("", response_model=ExaminerOut, status_code=201)
def add_examiner(
    request: CreateExaminerRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _perm: User = Depends(require_permission("belt_history:create")),
) -> Examiner:

    name = request.name.strip()

    if not name:
        raise BadRequestException("Le nom de l'examinateur ne peut pas être vide.")

    grade = request.grade.strip() if request.grade else None

    # "Ajouter" reste idempotent : si ce nom existe déjà (insensible à
    # la casse), on renvoie simplement l'entrée existante plutôt que
    # de rejeter en 409 - l'utilisateur clique juste sur "Ajouter",
    # peu importe que le nom soit déjà connu ou non. Un grade non vide
    # fourni ici met à jour (corrige) le grade déjà enregistré, pour
    # permettre de le renseigner ou de le corriger après coup.
    existing = (
        db.query(Examiner).filter(func.lower(Examiner.name) == name.lower()).first()
    )
    if existing is not None:
        if grade and existing.grade != grade:
            existing.grade = grade
            db.commit()
            db.refresh(existing)
        return existing

    examiner = Examiner(name=name, grade=grade, created_by_username=current_user.username)

    db.add(examiner)
    db.commit()
    db.refresh(examiner)

    return examiner


def upsert_examiner(
    db: Session, name: str | None, created_by_username: str, grade: str | None = None
) -> None:
    """Enregistre ce nom (et son grade s'il est fourni) dans la liste
    réutilisable des examinateurs s'il n'y figure pas déjà (insensible
    à la casse), sans lever d'erreur ni commit séparé (appelant
    responsable du commit). Si l'examinateur existe déjà et qu'un
    grade non vide est fourni, il remplace le grade déjà enregistré.

    Utilisé depuis app/routers/belt_history.py pour que tout nom (et
    grade) d'examinateur saisi lors d'un passage de ceinture alimente
    aussi l'auto-complétion réutilisable, même sans clic explicite sur
    le bouton "Ajouter" de l'écran Historique de ceinture.
    """
    if not name:
        return

    name = name.strip()
    if not name:
        return

    grade = grade.strip() if grade else None

    existing = (
        db.query(Examiner).filter(func.lower(Examiner.name) == name.lower()).first()
    )
    if existing is not None:
        if grade and existing.grade != grade:
            existing.grade = grade
        return

    db.add(Examiner(name=name, grade=grade, created_by_username=created_by_username))
