"""
Modèles SQLAlchemy — équivalent Python des entités JPA du backend
Java d'origine (cd.ajcmakina.judocard.*).

NOTE SUR "belt" (ceinture) :
Stockée en simple VARCHAR(20), PAS en type ENUM natif PostgreSQL.
C'est un choix délibéré, dans le même esprit que BeltConverter côté
Java : un ENUM natif ferait échouer toute la requête si une valeur
inattendue se trouvait en base, alors qu'un VARCHAR + validation
tolérante côté application (voir app/schemas.py, fonction
`normalize_belt`) permet de toujours répondre avec la liste des
adhérents, quitte à traiter une valeur inconnue comme "non définie".
"""

from datetime import datetime

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    username: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    email: Mapped[str] = mapped_column(String(150), unique=True, nullable=False)
    full_name: Mapped[str | None] = mapped_column(String(150), nullable=True)
    # Hash bcrypt — jamais renvoyé au client (voir app/schemas.py, UserSummary).
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(20), nullable=False, default="ADMIN")
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    # Autorisations accordées par un administrateur à ce compte -
    # liste de clés séparées par des virgules, au format
    # "ressource:action" (ex. "members:read,members:create") - voir
    # schemas.PERMISSION_KEYS. Sans effet pour un compte ADMIN, qui a
    # toujours accès à tout (voir dependencies.require_permission).
    permissions: Mapped[str | None] = mapped_column(String(255), nullable=True)
    # Marqueur technique de migration (voir app/migrations.py,
    # upgrade_legacy_permissions()) - NE PAS renommer/supprimer sans
    # adapter cette migration. Colonne ajoutée par ALTER TABLE SANS
    # valeur par défaut SQL : un compte déjà existant au moment de
    # cette mise à jour démarre donc à NULL (détecté par la
    # migration, qui lui accorde une fois pour toutes l'équivalent de
    # son accès précédent - avant cette mise à jour, la LECTURE
    # n'était jamais restreinte, quelles que soient les autorisations
    # du compte - puis passe ce champ à True). Un compte créé APRES
    # cette mise à jour reçoit True dès sa création (valeur par
    # défaut Python ci-dessous, appliquée par SQLAlchemy à
    # l'insertion, jamais par la migration) : il démarre donc avec
    # uniquement les autorisations explicitement cochées par un
    # administrateur, lecture comprise.
    legacy_permissions_migrated: Mapped[bool | None] = mapped_column(
        Boolean, nullable=True, default=True
    )


class Member(Base):
    __tablename__ = "members"
    __table_args__ = (
        UniqueConstraint("phone", name="uq_members_phone"),
        UniqueConstraint("email", name="uq_members_email"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    first_name: Mapped[str] = mapped_column(String(150), nullable=False)
    last_name: Mapped[str] = mapped_column(String(150), nullable=False)
    phone: Mapped[str | None] = mapped_column(String(30), nullable=True)
    email: Mapped[str | None] = mapped_column(String(150), nullable=True)
    birth_date: Mapped[Date | None] = mapped_column(Date, nullable=True)
    # "address" reste la version composée, lisible, de l'adresse -
    # calculée automatiquement à partir des 4 champs structurés
    # ci-dessous (voir schemas.compose_address()) et stockée ici pour
    # rester compatible avec tout ce qui affichait déjà "address"
    # (carte, QR code, recherche) sans devoir toucher ces endroits.
    address: Mapped[str | None] = mapped_column(String(255), nullable=True)
    commune: Mapped[str | None] = mapped_column(String(150), nullable=True)
    quartier: Mapped[str | None] = mapped_column(String(150), nullable=True)
    avenue: Mapped[str | None] = mapped_column(String(150), nullable=True)
    numero: Mapped[str | None] = mapped_column(String(30), nullable=True)
    # "Masculin" / "Féminin" - voir normalize_sexe() dans app/schemas.py.
    sexe: Mapped[str | None] = mapped_column(String(10), nullable=True)
    belt: Mapped[str | None] = mapped_column(String(20), nullable=True)
    photo: Mapped[str | None] = mapped_column(String(255), nullable=True)
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
    # Nom d'utilisateur (compte connecté) ayant créé / modifié en
    # dernier cette fiche - traçabilité "qui a fait l'action". Stocké
    # comme simple chaîne (pas de clé étrangère) pour rester lisible
    # même si le compte utilisateur est supprimé par la suite.
    created_by_username: Mapped[str | None] = mapped_column(String(100), nullable=True)
    updated_by_username: Mapped[str | None] = mapped_column(String(100), nullable=True)

    card: Mapped["Card | None"] = relationship(
        back_populates="member", uselist=False
    )
    belt_history: Mapped[list["BeltHistory"]] = relationship(
        back_populates="member", cascade="all, delete-orphan"
    )


class Card(Base):
    __tablename__ = "cards"
    __table_args__ = (
        UniqueConstraint("card_number", name="uq_cards_card_number"),
        UniqueConstraint("member_id", name="uq_cards_member_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    card_number: Mapped[str] = mapped_column(String(50), nullable=False)
    member_id: Mapped[int] = mapped_column(
        ForeignKey("members.id", ondelete="CASCADE"), nullable=False
    )
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="ACTIVE")
    # QR code encodé en Base64 (data URL complète) - potentiellement
    # plusieurs milliers de caractères, d'où Text plutôt que String.
    qr_code: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
    # Utilisateur connecté ayant créé cette carte - voir le
    # commentaire équivalent sur Member.created_by_username.
    created_by_username: Mapped[str | None] = mapped_column(String(100), nullable=True)

    member: Mapped["Member"] = relationship(back_populates="card")


class BeltHistory(Base):
    __tablename__ = "belt_history"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    member_id: Mapped[int] = mapped_column(
        ForeignKey("members.id", ondelete="CASCADE"), nullable=False
    )
    # Peut être null si c'est la toute première ceinture du membre.
    ancienne_ceinture: Mapped[str | None] = mapped_column(String(20), nullable=True)
    nouvelle_ceinture: Mapped[str] = mapped_column(String(20), nullable=False)
    date_passage: Mapped[Date] = mapped_column(Date, nullable=False)
    observation: Mapped[str | None] = mapped_column(String(500), nullable=True)
    # Nom(s) de la ou des personnes ayant fait passer l'examen de grade
    # (peuvent être différentes de l'utilisateur connecté qui saisit le
    # passage). Jusqu'à 3 examinateurs par passage - `examinateur` reste
    # le nom de colonne du premier examinateur pour ne pas casser les
    # données déjà enregistrées par les versions précédentes.
    examinateur: Mapped[str | None] = mapped_column(String(150), nullable=True)
    examinateur2: Mapped[str | None] = mapped_column(String(150), nullable=True)
    examinateur3: Mapped[str | None] = mapped_column(String(150), nullable=True)

    member: Mapped["Member"] = relationship(back_populates="belt_history")


class ClubSettings(Base):
    """
    Paramètres du club (ligne unique - pattern "singleton row").
    Voir app/routers/settings.py: get_or_create_settings() qui crée
    cette ligne par défaut si elle n'existe pas encore.
    """

    __tablename__ = "club_settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    club_name: Mapped[str] = mapped_column(String(150), nullable=False)
    address: Mapped[str | None] = mapped_column(String(255), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(30), nullable=True)
    email: Mapped[str | None] = mapped_column(String(150), nullable=True)
    logo_path: Mapped[str | None] = mapped_column(String(255), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
    # Utilisateur (forcément ADMIN, voir require_admin) ayant modifié
    # en dernier les paramètres du club.
    updated_by_username: Mapped[str | None] = mapped_column(String(100), nullable=True)


class VerificationLog(Base):
    __tablename__ = "verification_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    card_number: Mapped[str | None] = mapped_column(String(50), nullable=True)
    found: Mapped[bool] = mapped_column(Boolean, nullable=False)
    member_id: Mapped[int | None] = mapped_column(
        ForeignKey("members.id", ondelete="SET NULL"), nullable=True
    )
    verified_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    verified_by_username: Mapped[str | None] = mapped_column(
        String(100), nullable=True
    )

    member: Mapped["Member | None"] = relationship()


class ActivityLog(Base):
    """
    Journal d'activité central : une ligne lisible par action
    importante (création/modification d'adhérent, création de carte,
    modification des paramètres du club, vérification de carte),
    avec le nom de l'utilisateur connecté qui l'a effectuée. Alimenté
    depuis app/activity.py (log_activity()), consulté par
    app/routers/activity_log.py.

    Volontairement une simple table plate (username + description
    en texte lisible), sans clé étrangère vers l'entité concernée :
    reste consultable et lisible même si l'adhérent/la carte/l'
    utilisateur a été supprimé depuis.
    """

    __tablename__ = "activity_log"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    username: Mapped[str] = mapped_column(String(100), nullable=False)
    action: Mapped[str] = mapped_column(String(50), nullable=False)
    description: Mapped[str] = mapped_column(String(500), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class Examiner(Base):
    """
    Liste réutilisable des examinateurs (personnes habilitées à faire
    passer un examen de grade). Alimentée via le bouton "Ajouter" de
    l'écran Historique de ceinture (voir app/routers/examiners.py) -
    permet de sélectionner un examinateur déjà utilisé plutôt que de
    retaper son nom à chaque passage.
    """

    __tablename__ = "examiners"
    __table_args__ = (UniqueConstraint("name", name="uq_examiners_name"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    # Grade de l'examinateur (ex. "4e Dan"), facultatif - saisi via le
    # bouton "Ajouter" de l'écran Historique de ceinture, affiché
    # ensuite à côté de son nom partout où il est mentionné.
    grade: Mapped[str | None] = mapped_column(String(100), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    created_by_username: Mapped[str | None] = mapped_column(String(100), nullable=True)
