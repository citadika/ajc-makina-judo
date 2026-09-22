"""
Journal d'activité — petite fonction utilitaire appelée depuis les
routeurs (members, cards, settings, verifications) à chaque action
importante, pour garder une trace lisible de "qui a fait quoi".

Volontairement très simple : une ligne de texte par action, avec le
nom de l'utilisateur connecté au moment de l'action. Consultable via
GET /api/activity-log (app/routers/activity_log.py) et affiché dans
l'écran "Journal d'activité" côté frontend.
"""

from sqlalchemy.orm import Session

from app.models import ActivityLog


def log_activity(db: Session, username: str, action: str, description: str) -> None:
    """Ajoute une ligne au journal d'activité, dans la même session/
    transaction que l'action elle-même (pas de commit ici : le
    routeur appelant fait déjà un db.commit() juste après, ce qui
    enregistre les deux en une seule transaction)."""

    db.add(ActivityLog(username=username, action=action, description=description))
