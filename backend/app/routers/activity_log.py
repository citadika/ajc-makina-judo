"""
Journal d'activité — historique lisible de "qui a fait quoi"
(création/modification d'un adhérent, création d'une carte,
modification des paramètres du club, vérification d'une carte).

Alimenté depuis les autres routeurs via app/activity.py, pas de route
d'écriture ici : ce routeur ne fait que lister.

Consultation soumise à la permission "activity_log:read" : avant
cette mise à jour, le journal d'audit était visible par tout compte
authentifié, sans aucune case à cocher - un compte ADMIN passe
toujours, et les comptes déjà existants sont mis à niveau
automatiquement (voir app/migrations.py, upgrade_legacy_permissions).
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.dependencies import get_current_user, get_db, require_permission
from app.models import ActivityLog, User
from app.schemas import ActivityLogOut

router = APIRouter(prefix="/api/activity-log", tags=["activity-log"])


@router.get("", response_model=list[ActivityLogOut])
def get_activity_log(
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
    _perm: User = Depends(require_permission("activity_log:read")),
) -> list[ActivityLog]:

    return (
        db.query(ActivityLog)
        .order_by(ActivityLog.created_at.desc(), ActivityLog.id.desc())
        .limit(100)
        .all()
    )
