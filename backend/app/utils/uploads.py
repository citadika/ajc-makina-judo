"""
Enregistrement / suppression de fichiers uploadés (photos de
membres, logo du club).

Equivalent Python des méthodes savePhoto/deletePhoto dupliquées dans
MemberService.java et ClubSettingsService.java - factorisées ici en
un seul utilitaire partagé (contrairement au Java d'origine, qui les
dupliquait volontairement ; rien n'empêche de partager ce code côté
Python).
"""

import uuid
from pathlib import Path

from fastapi import UploadFile

from app.exceptions import BadRequestException

_ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp"}
_MAX_SIZE_BYTES = 5 * 1024 * 1024  # 5 Mo

UPLOAD_ROOT = Path(__file__).resolve().parent.parent.parent / "uploads"
MEMBERS_DIR = UPLOAD_ROOT / "members"
SETTINGS_DIR = UPLOAD_ROOT / "settings"

MEMBERS_DIR.mkdir(parents=True, exist_ok=True)
SETTINGS_DIR.mkdir(parents=True, exist_ok=True)


async def save_upload(upload: UploadFile | None, directory: Path) -> str | None:
    """Enregistre un fichier image uploadé (JPG/PNG/WEBP, max 5 Mo)
    sous un nom unique (UUID) dans `directory`, et renvoie ce nom de
    fichier (pas le chemin complet). Renvoie None si `upload` est
    absent/vide."""

    if upload is None or not upload.filename:
        return None

    content_type = upload.content_type

    if content_type not in _ALLOWED_CONTENT_TYPES:
        raise BadRequestException(
            "Format de fichier non autorisé. Utilisez JPG, PNG ou WEBP."
        )

    contents = await upload.read()

    if len(contents) > _MAX_SIZE_BYTES:
        raise BadRequestException("Le fichier ne doit pas dépasser 5 Mo.")

    if len(contents) == 0:
        return None

    original_name = upload.filename
    extension = ".jpg"

    if "." in original_name:
        extension = "." + original_name.rsplit(".", 1)[-1].lower()

    filename = f"{uuid.uuid4()}{extension}"
    target = directory / filename

    target.write_bytes(contents)

    return filename


def delete_upload(filename: str | None, directory: Path) -> None:
    """Supprime un fichier précédemment enregistré via save_upload,
    en toute sécurité (ne sort jamais de `directory`)."""

    if not filename:
        return

    if filename.startswith(("http://", "https://", "data:")):
        return

    target = (directory / filename).resolve()

    if directory.resolve() not in target.parents:
        return

    target.unlink(missing_ok=True)
