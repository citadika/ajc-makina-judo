"""
Schémas Pydantic (validation + sérialisation JSON).

Equivalent Python des DTOs du backend Java (member/dto/*.java,
auth/dto/*.java, settings/dto/*.java) + des entités elles-mêmes pour
les réponses (Member, Card, BeltHistory, UserSummary, ClubSettings,
VerificationLog).
"""

from __future__ import annotations

from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

Belt = Literal["BLANCHE", "JAUNE", "ORANGE", "VERTE", "BLEUE", "MARRON", "NOIRE"]

_VALID_BELTS = {"BLANCHE", "JAUNE", "ORANGE", "VERTE", "BLEUE", "MARRON", "NOIRE"}

# Anciennes valeurs (anglaises) pouvant exister dans des imports de
# données historiques - même logique tolérante que BeltConverter.java :
# une valeur héritée est traduite automatiquement plutôt que de faire
# échouer la requête.
_LEGACY_BELT_ALIASES = {
    "WHITE": "BLANCHE",
    "YELLOW": "JAUNE",
    "GREEN": "VERTE",
    "BLUE": "BLEUE",
    "BROWN": "MARRON",
    "BLACK": "NOIRE",
}


def normalize_belt(value: str | None) -> str | None:
    """Normalise une valeur de ceinture : accepte les valeurs françaises
    valides, traduit les anciennes valeurs anglaises connues, et
    traite toute autre valeur inconnue comme "non définie" (None)
    plutôt que de lever une erreur."""

    if value is None:
        return None

    normalized = value.strip().upper()

    if not normalized:
        return None

    if normalized in _VALID_BELTS:
        return normalized

    return _LEGACY_BELT_ALIASES.get(normalized)


Sexe = Literal["Masculin", "Féminin"]

_SEXE_ALIASES = {
    "MASCULIN": "Masculin",
    "M": "Masculin",
    "HOMME": "Masculin",
    "FEMININ": "Féminin",
    "FÉMININ": "Féminin",
    "F": "Féminin",
    "FEMME": "Féminin",
}


def normalize_sexe(value: str | None) -> str | None:
    """Même logique tolérante que normalize_belt() : accepte
    "Masculin"/"Féminin" (accents ou pas, casse quelconque) ainsi que
    quelques alias courants ("M"/"F"), et traite toute autre valeur
    comme "non défini" plutôt que d'échouer."""

    if value is None:
        return None

    normalized = value.strip().upper()

    if not normalized:
        return None

    return _SEXE_ALIASES.get(normalized)


def compose_address(
    commune: str | None,
    quartier: str | None,
    avenue: str | None,
    numero: str | None,
) -> str | None:
    """Construit une adresse lisible à partir des quatre champs
    structurés saisis à l'enregistrement (commune, quartier, avenue,
    numéro). Le résultat est stocké dans Member.address, qui reste
    ainsi le champ utilisé partout ailleurs (carte, QR code,
    recherche) sans rien changer à ces endroits."""

    numero = (numero or "").strip()
    avenue = (avenue or "").strip()
    quartier = (quartier or "").strip()
    commune = (commune or "").strip()

    parts: list[str] = []

    if numero and avenue:
        parts.append(f"N° {numero}, {avenue}")
    elif avenue:
        parts.append(avenue)
    elif numero:
        parts.append(f"N° {numero}")

    if quartier:
        parts.append(f"Quartier {quartier}")

    if commune:
        parts.append(f"Commune {commune}")

    return ", ".join(parts) if parts else None


# =====================================================
# AUTH
# =====================================================


class LoginRequest(BaseModel):
    username: str = Field(min_length=1, description="Nom d'utilisateur ou email")
    password: str = Field(min_length=1)


class LoginResponse(BaseModel):
    message: str
    token: str
    user_id: int = Field(serialization_alias="userId")
    username: str
    email: str
    full_name: str | None = Field(default=None, serialization_alias="fullName")
    role: str
    # Actions autorisées pour ce compte (voir PERMISSION_KEYS plus bas
    # dans ce fichier) - permet au frontend d'afficher/masquer les
    # sections en fonction des droits réels, sans devoir rappeler /me.
    permissions: list[str] = Field(default_factory=list)

    model_config = ConfigDict(populate_by_name=True)


class MeResponse(BaseModel):
    user_id: int = Field(serialization_alias="userId")
    username: str
    email: str
    full_name: str | None = Field(default=None, serialization_alias="fullName")
    role: str
    permissions: list[str] = Field(default_factory=list)

    model_config = ConfigDict(populate_by_name=True)


# =====================================================
# MEMBERS
# =====================================================


class MemberCreate(BaseModel):
    first_name: str = Field(min_length=1, alias="firstName")
    last_name: str = Field(min_length=1, alias="lastName")
    phone: str | None = None
    email: EmailStr | None = None
    birth_date: date | None = Field(default=None, alias="birthDate")
    # Adresse saisie en 4 champs structurés plutôt qu'en texte libre -
    # voir compose_address() ci-dessus, qui en dérive Member.address.
    commune: str | None = None
    quartier: str | None = None
    avenue: str | None = None
    numero: str | None = None
    sexe: str | None = None
    belt: str | None = None

    model_config = ConfigDict(populate_by_name=True)

    @field_validator("belt")
    @classmethod
    def _validate_belt(cls, v: str | None) -> str | None:
        return normalize_belt(v)

    @field_validator("sexe")
    @classmethod
    def _validate_sexe(cls, v: str | None) -> str | None:
        return normalize_sexe(v)

    @field_validator("phone", "email", "commune", "quartier", "avenue", "numero", mode="before")
    @classmethod
    def _blank_to_none(cls, v):
        if isinstance(v, str) and not v.strip():
            return None
        return v


class MemberUpdate(BaseModel):
    first_name: str | None = Field(default=None, alias="firstName")
    last_name: str | None = Field(default=None, alias="lastName")
    phone: str | None = None
    email: EmailStr | None = None
    birth_date: date | None = Field(default=None, alias="birthDate")
    commune: str | None = None
    quartier: str | None = None
    avenue: str | None = None
    numero: str | None = None
    sexe: str | None = None
    belt: str | None = None
    active: bool | None = None

    model_config = ConfigDict(populate_by_name=True)

    @field_validator("belt")
    @classmethod
    def _validate_belt(cls, v: str | None) -> str | None:
        return normalize_belt(v)

    @field_validator("sexe")
    @classmethod
    def _validate_sexe(cls, v: str | None) -> str | None:
        return normalize_sexe(v)

    @field_validator("phone", "email", "commune", "quartier", "avenue", "numero", mode="before")
    @classmethod
    def _blank_to_none(cls, v):
        if isinstance(v, str) and not v.strip():
            return None
        return v


class MemberOut(BaseModel):
    id: int
    first_name: str = Field(serialization_alias="firstName")
    last_name: str = Field(serialization_alias="lastName")
    phone: str | None = None
    email: str | None = None
    birth_date: date | None = Field(default=None, serialization_alias="birthDate")
    # Adresse composée, lisible - utilisée pour l'affichage (carte,
    # fiche adhérent, QR code).
    address: str | None = None
    # Champs structurés bruts - utilisés pour pré-remplir le
    # formulaire de modification.
    commune: str | None = None
    quartier: str | None = None
    avenue: str | None = None
    numero: str | None = None
    sexe: str | None = None
    belt: str | None = None
    photo: str | None = None
    active: bool
    created_at: datetime = Field(serialization_alias="createdAt")
    updated_at: datetime = Field(serialization_alias="updatedAt")
    # Traçabilité "qui a fait l'action" - voir Member.created_by_username
    # dans app/models.py.
    created_by_username: str | None = Field(
        default=None, serialization_alias="createdByUsername"
    )
    updated_by_username: str | None = Field(
        default=None, serialization_alias="updatedByUsername"
    )

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


# =====================================================
# CARDS
# =====================================================


class CardOut(BaseModel):
    id: int
    card_number: str = Field(serialization_alias="cardNumber")
    member: MemberOut
    status: str
    qr_code: str | None = Field(default=None, serialization_alias="qrCode")
    created_at: datetime = Field(serialization_alias="createdAt")
    updated_at: datetime = Field(serialization_alias="updatedAt")
    created_by_username: str | None = Field(
        default=None, serialization_alias="createdByUsername"
    )

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


# =====================================================
# BELT HISTORY
# =====================================================


class PromoteBeltRequest(BaseModel):
    nouvelle_ceinture: str = Field(min_length=1, alias="nouvelleCeinture")
    # Facultative : si absente, le serveur utilise la date du jour.
    # Permet de saisir un passage de ceinture rétroactif (ou de le
    # dater explicitement plutôt que de toujours utiliser "aujourd'hui").
    date_passage: date | None = Field(default=None, alias="datePassage")
    observation: str | None = Field(default=None, max_length=500)
    # Jusqu'à 3 examinateurs par passage - tous facultatifs, `examinateur`
    # est le premier (voir app/models.py, BeltHistory).
    examinateur: str | None = Field(default=None, max_length=150)
    examinateur2: str | None = Field(default=None, max_length=150)
    examinateur3: str | None = Field(default=None, max_length=150)
    # Grade de chaque examinateur (ex. "4e Dan"), facultatif - ne sont
    # PAS enregistrés sur le passage lui-même : ils servent uniquement
    # à créer/mettre à jour le grade de l'examinateur correspondant
    # dans la liste réutilisable (voir app/routers/belt_history.py,
    # promote(), et app/routers/examiners.py, upsert_examiner()).
    examinateur_grade: str | None = Field(default=None, max_length=100, alias="examinateurGrade")
    examinateur2_grade: str | None = Field(default=None, max_length=100, alias="examinateur2Grade")
    examinateur3_grade: str | None = Field(default=None, max_length=100, alias="examinateur3Grade")

    model_config = ConfigDict(populate_by_name=True)

    @field_validator("examinateur", "examinateur2", "examinateur3", "examinateur_grade", "examinateur2_grade", "examinateur3_grade")
    @classmethod
    def _blank_examinateur_to_none(cls, v: str | None) -> str | None:
        if v is None:
            return None
        v = v.strip()
        return v or None

    @field_validator("nouvelle_ceinture")
    @classmethod
    def _validate_belt(cls, v: str) -> str:
        normalized = normalize_belt(v)
        if normalized is None:
            raise ValueError(f"Ceinture invalide : {v}")
        return normalized


class UpdateBeltHistoryRequest(BaseModel):
    """Permet de corriger la date (et éventuellement l'observation et
    les examinateurs) d'un passage de ceinture déjà enregistré."""

    date_passage: date = Field(alias="datePassage")
    observation: str | None = Field(default=None, max_length=500)
    examinateur: str | None = Field(default=None, max_length=150)
    examinateur2: str | None = Field(default=None, max_length=150)
    examinateur3: str | None = Field(default=None, max_length=150)
    examinateur_grade: str | None = Field(default=None, max_length=100, alias="examinateurGrade")
    examinateur2_grade: str | None = Field(default=None, max_length=100, alias="examinateur2Grade")
    examinateur3_grade: str | None = Field(default=None, max_length=100, alias="examinateur3Grade")

    model_config = ConfigDict(populate_by_name=True)

    @field_validator("examinateur", "examinateur2", "examinateur3", "examinateur_grade", "examinateur2_grade", "examinateur3_grade")
    @classmethod
    def _blank_examinateur_to_none(cls, v: str | None) -> str | None:
        if v is None:
            return None
        v = v.strip()
        return v or None


class BeltHistoryOut(BaseModel):
    id: int
    member: MemberOut
    ancienne_ceinture: str | None = Field(
        default=None, serialization_alias="ancienneCeinture"
    )
    nouvelle_ceinture: str = Field(serialization_alias="nouvelleCeinture")
    date_passage: date = Field(serialization_alias="datePassage")
    observation: str | None = None
    examinateur: str | None = None
    examinateur2: str | None = None
    examinateur3: str | None = None

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


# =====================================================
# USERS
# =====================================================

# Autorisations accordées par un administrateur à un compte, lors de
# sa création/modification - voir app/dependencies.py
# (require_permission()), utilisées pour gater CHAQUE action
# (lecture/ajout/modification/suppression) des routeurs
# members/cards/belt_history/verifications/examiners/activity_log.
# Sans effet pour un compte ADMIN, qui a toujours accès à tout.
#
# Chaque ressource n'expose que les actions qui existent réellement
# dans son API (ex. pas de "suppression" pour les cartes, il n'existe
# aucun endpoint DELETE /api/cards). Clé finale au format
# "ressource:action" (ex. "members:read", "belt_history:create").
PERMISSION_ACTIONS: dict[str, list[str]] = {
    "members": ["read", "create", "update", "delete"],
    "cards": ["read", "create", "update"],
    "belt_history": ["read", "create", "update"],
    "verifications": ["read", "create", "delete"],
    "activity_log": ["read"],
}

PERMISSION_KEYS: list[str] = [
    f"{resource}:{action}" for resource, actions in PERMISSION_ACTIONS.items() for action in actions
]

# Anciennes clés (avant l'introduction du modèle granulaire) - utilisées
# uniquement par la migration de compatibilité (voir
# app/migrations.py, upgrade_legacy_permissions()) pour traduire les
# autorisations déjà accordées aux comptes existants.
LEGACY_PERMISSION_KEYS: list[str] = ["members", "cards", "belt_history", "verifications"]


def parse_permissions(raw: str | None) -> list[str]:
    """Convertit la chaîne "members,cards" stockée en base en liste
    Python, en ignorant les clés vides/inconnues."""

    if not raw:
        return []
    return [p.strip() for p in raw.split(",") if p.strip()]


def serialize_permissions(perms: list[str] | None) -> str | None:
    """Inverse de parse_permissions() - chaîne prête à stocker en base."""

    if not perms:
        return None
    return ",".join(sorted(set(perms)))


class CreateUserRequest(BaseModel):
    username: str = Field(min_length=1)
    email: EmailStr
    password: str = Field(min_length=6)
    full_name: str | None = Field(default=None, alias="fullName")
    role: str = Field(min_length=1)
    # Actions autorisées pour ce compte (voir PERMISSION_KEYS) - sans
    # effet si role="ADMIN" (accès complet dans tous les cas).
    permissions: list[str] = Field(default_factory=list)

    model_config = ConfigDict(populate_by_name=True)

    @field_validator("permissions")
    @classmethod
    def _validate_permissions(cls, v: list[str]) -> list[str]:
        unknown = [p for p in v if p not in PERMISSION_KEYS]
        if unknown:
            raise ValueError(f"Autorisation(s) inconnue(s) : {', '.join(unknown)}")
        return v


class UpdateUserRequest(BaseModel):
    email: EmailStr | None = None
    full_name: str | None = Field(default=None, alias="fullName")
    role: str | None = None
    password: str | None = Field(default=None, min_length=6)
    permissions: list[str] | None = None

    model_config = ConfigDict(populate_by_name=True)

    @field_validator("permissions")
    @classmethod
    def _validate_permissions(cls, v: list[str] | None) -> list[str] | None:
        if v is None:
            return None
        unknown = [p for p in v if p not in PERMISSION_KEYS]
        if unknown:
            raise ValueError(f"Autorisation(s) inconnue(s) : {', '.join(unknown)}")
        return v


class UserSummary(BaseModel):
    id: int
    username: str
    email: str
    full_name: str | None = Field(default=None, serialization_alias="fullName")
    role: str
    enabled: bool
    permissions: list[str] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    @field_validator("permissions", mode="before")
    @classmethod
    def _parse_permissions(cls, v: object) -> list[str]:
        if isinstance(v, str) or v is None:
            return parse_permissions(v)  # type: ignore[arg-type]
        return list(v)  # type: ignore[arg-type]


# =====================================================
# CLUB SETTINGS
# =====================================================


class UpdateSettingsRequest(BaseModel):
    club_name: str | None = Field(default=None, max_length=150, alias="clubName")
    address: str | None = Field(default=None, max_length=255)
    phone: str | None = Field(default=None, max_length=30)
    email: EmailStr | None = Field(default=None)

    model_config = ConfigDict(populate_by_name=True)


class ClubSettingsOut(BaseModel):
    id: int
    club_name: str = Field(serialization_alias="clubName")
    address: str | None = None
    phone: str | None = None
    email: str | None = None
    logo_path: str | None = Field(default=None, serialization_alias="logoPath")
    updated_at: datetime = Field(serialization_alias="updatedAt")
    updated_by_username: str | None = Field(
        default=None, serialization_alias="updatedByUsername"
    )

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


# =====================================================
# VERIFICATION
# =====================================================


class VerificationLogOut(BaseModel):
    id: int
    card_number: str | None = Field(default=None, serialization_alias="cardNumber")
    found: bool
    member: MemberOut | None = None
    verified_at: datetime = Field(serialization_alias="verifiedAt")
    verified_by_username: str | None = Field(
        default=None, serialization_alias="verifiedByUsername"
    )

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


# =====================================================
# EXAMINATEURS
# =====================================================


class ExaminerOut(BaseModel):
    id: int
    name: str
    grade: str | None = None

    model_config = ConfigDict(from_attributes=True)


class CreateExaminerRequest(BaseModel):
    name: str = Field(min_length=1, max_length=150)
    # Grade de l'examinateur (ex. "4e Dan"), facultatif. Si ce nom
    # existe déjà dans la liste réutilisable et qu'un grade non vide
    # est fourni, il remplace le grade déjà enregistré (voir
    # app/routers/examiners.py, add_examiner) - permet de corriger le
    # grade d'un examinateur déjà connu sans passer par un autre écran.
    grade: str | None = Field(default=None, max_length=100)

    @field_validator("grade")
    @classmethod
    def _blank_grade_to_none(cls, v: str | None) -> str | None:
        if v is None:
            return None
        v = v.strip()
        return v or None


# =====================================================
# JOURNAL D'ACTIVITÉ
# =====================================================


class ActivityLogOut(BaseModel):
    id: int
    username: str
    action: str
    description: str
    created_at: datetime = Field(serialization_alias="createdAt")

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


# =====================================================
# ERREURS
# =====================================================


class ApiError(BaseModel):
    status: int
    error: str
    message: str
    path: str
    timestamp: datetime
    details: list[str] | None = None
