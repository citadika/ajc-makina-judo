"""
Paramètres du club (ligne unique). Equivalent Python de
ClubSettingsController.java + ClubSettingsService.java.
"""

from fastapi import APIRouter, Depends, Form, UploadFile
from pydantic import ValidationError
from sqlalchemy.orm import Session

from app.activity import log_activity
from app.dependencies import get_current_user, get_db, require_admin
from app.exceptions import BadRequestException
from app.models import ClubSettings, User
from app.schemas import ClubSettingsOut, UpdateSettingsRequest
from app.utils.uploads import SETTINGS_DIR, delete_upload, save_upload

router = APIRouter(prefix="/api/settings", tags=["settings"])


def get_or_create_settings(db: Session) -> ClubSettings:

    settings_row = db.query(ClubSettings).first()

    if settings_row is not None:
        return settings_row

    settings_row = ClubSettings(club_name="AJC MAKINA")
    db.add(settings_row)
    db.commit()
    db.refresh(settings_row)

    return settings_row


@router.get("", response_model=ClubSettingsOut)
def read_settings(
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
) -> ClubSettings:

    return get_or_create_settings(db)


@router.put("", response_model=ClubSettingsOut)
async def update_settings(
    settings: str = Form(...),
    logo: UploadFile | None = None,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
) -> ClubSettings:

    try:
        request = UpdateSettingsRequest.model_validate_json(settings)
    except ValidationError as exc:
        raise BadRequestException(f"Données paramètres invalides : {exc}")

    settings_row = get_or_create_settings(db)

    if request.club_name is not None:
        settings_row.club_name = request.club_name
    if request.address is not None:
        settings_row.address = request.address
    if request.phone is not None:
        settings_row.phone = request.phone
    if request.email is not None:
        settings_row.email = request.email

    if logo is not None and logo.filename:
        old_logo = settings_row.logo_path
        new_logo = await save_upload(logo, SETTINGS_DIR)
        if new_logo is not None:
            settings_row.logo_path = new_logo
            if old_logo:
                delete_upload(old_logo, SETTINGS_DIR)

    settings_row.updated_by_username = admin.username
    log_activity(db, admin.username, "settings_updated", "Paramètres du club modifiés")

    db.commit()
    db.refresh(settings_row)

    return settings_row
