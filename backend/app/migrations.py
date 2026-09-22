"""
Petites migrations de schéma, exécutées automatiquement au démarrage.

Base.metadata.create_all() (voir app/main.py) crée les tables
manquantes mais NE MODIFIE JAMAIS une table déjà existante - c'est un
problème réel rencontré en usage réel : l'ajout du champ "sexe" à
Member a fait échouer /api/members et /api/cards avec une erreur 503
générique ("Problème temporaire de connexion à la base de données")
tant que la colonne n'avait pas été ajoutée manuellement en base
avec un ALTER TABLE.

Pour que cela ne se reproduise plus à chaque nouvelle fonctionnalité,
les instructions ci-dessous rattrapent automatiquement les colonnes
manquantes sur les tables déjà existantes, via
"ADD COLUMN IF NOT EXISTS" (supporté nativement par PostgreSQL,
idempotent - aucun risque à les ré-exécuter à chaque démarrage).

Pour ajouter une future colonne à un modèle existant : ajouter le
modèle SQLAlchemy dans app/models.py comme d'habitude, ET ajouter la
ligne ALTER TABLE correspondante ci-dessous. Sans cette deuxième
étape, la colonne n'existera que côté code, pas en base, et les
requêtes concernées échoueront avec la même erreur 503 générique que
précédemment.
"""

import logging

from sqlalchemy import text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

logger = logging.getLogger("judocard")

# Une instruction par colonne ajoutée après la création initiale des
# tables. L'ordre n'a pas d'importance (toutes idempotentes).
_ALTER_STATEMENTS: list[str] = [
    'ALTER TABLE members ADD COLUMN IF NOT EXISTS sexe VARCHAR(10)',
    'ALTER TABLE members ADD COLUMN IF NOT EXISTS commune VARCHAR(150)',
    'ALTER TABLE members ADD COLUMN IF NOT EXISTS quartier VARCHAR(150)',
    'ALTER TABLE members ADD COLUMN IF NOT EXISTS avenue VARCHAR(150)',
    'ALTER TABLE members ADD COLUMN IF NOT EXISTS numero VARCHAR(30)',
    'ALTER TABLE belt_history ADD COLUMN IF NOT EXISTS examinateur VARCHAR(150)',
    'ALTER TABLE members ADD COLUMN IF NOT EXISTS created_by_username VARCHAR(100)',
    'ALTER TABLE members ADD COLUMN IF NOT EXISTS updated_by_username VARCHAR(100)',
    'ALTER TABLE cards ADD COLUMN IF NOT EXISTS created_by_username VARCHAR(100)',
    'ALTER TABLE club_settings ADD COLUMN IF NOT EXISTS updated_by_username VARCHAR(100)',
    'ALTER TABLE users ADD COLUMN IF NOT EXISTS permissions VARCHAR(255)',
    'ALTER TABLE belt_history ADD COLUMN IF NOT EXISTS examinateur2 VARCHAR(150)',
    'ALTER TABLE belt_history ADD COLUMN IF NOT EXISTS examinateur3 VARCHAR(150)',
    # "examiners" existait déjà (table créée pour la liste réutilisable
    # des examinateurs) avant l'ajout du champ "grade" : celui-ci doit
    # donc bien être rattrapé ici, contrairement à sa création initiale.
    'ALTER TABLE examiners ADD COLUMN IF NOT EXISTS grade VARCHAR(100)',
    # SANS valeur par défaut SQL, volontairement : voir
    # app/models.py (User.legacy_permissions_migrated) et
    # upgrade_legacy_permissions() ci-dessous - c'est ce qui permet de
    # distinguer un compte déjà existant (NULL après cet ALTER TABLE)
    # d'un compte créé après cette mise à jour (True, appliqué par
    # SQLAlchemy côté Python à l'insertion, jamais ici).
    'ALTER TABLE users ADD COLUMN IF NOT EXISTS legacy_permissions_migrated BOOLEAN',
    # Pas de colonne à ajouter pour activity_log : c'est une toute
    # nouvelle table, créée automatiquement par
    # Base.metadata.create_all() (voir app/main.py) - ces migrations ne
    # servent qu'à rattraper des colonnes manquantes sur des tables
    # déjà existantes.
]


def run_lightweight_migrations(engine: Engine) -> None:
    with engine.begin() as conn:
        for statement in _ALTER_STATEMENTS:
            conn.execute(text(statement))

    logger.info(
        "Migrations légères appliquées (%d instruction(s) ADD COLUMN IF NOT EXISTS).",
        len(_ALTER_STATEMENTS),
    )


def upgrade_legacy_permissions(engine: Engine) -> None:
    """Comptes USER créés AVANT l'introduction des autorisations
    granulaires (lecture/ajout/modification/suppression séparées par
    ressource, voir app/schemas.py PERMISSION_ACTIONS) : jusqu'ici, la
    LECTURE (listes, fiches, historiques, journal d'activité) était
    ouverte à tout compte connecté, sans aucune case à cocher - seules
    les actions d'écriture étaient soumises à autorisation. Pour ne
    rien casser à cette mise à jour, tout compte déjà existant
    (repéré via `legacy_permissions_migrated IS NULL`, voir
    app/models.py) reçoit une fois pour toutes l'équivalent de son
    accès précédent :
      - la lecture ("resource:read") sur TOUTES les ressources
        (y compris le nouveau journal d'audit, lui aussi ouvert à
        tous auparavant) ;
      - ses anciennes autorisations d'écriture traduites en CRUD
        complet sur la ressource concernée (ex. l'ancienne clé
        "members" devient "members:read,members:create,
        members:update,members:delete").

    Idempotent (ne retouche plus un compte une fois
    legacy_permissions_migrated passé à True). Un compte créé APRES
    cette mise à jour ne passe jamais par cette fonction - il démarre
    à True dès sa création (voir app/models.py) et n'a donc que les
    autorisations explicitement cochées par un administrateur.
    """

    # Import différé pour éviter tout risque de cycle d'import avec
    # app/schemas.py (qui n'importe pas ce module).
    from app.schemas import PERMISSION_ACTIONS

    with Session(engine) as db:
        rows = db.execute(
            text(
                "SELECT id, permissions FROM users "
                "WHERE role != 'ADMIN' AND legacy_permissions_migrated IS NULL"
            )
        ).fetchall()

        if not rows:
            return

        for user_id, raw_permissions in rows:
            old_keys = {p.strip() for p in (raw_permissions or "").split(",") if p.strip()}
            new_keys: set[str] = set()

            # Lecture : ouverte à tous avant cette mise à jour, sur
            # toutes les ressources sans exception.
            for resource in PERMISSION_ACTIONS:
                new_keys.add(f"{resource}:read")

            # Anciennes autorisations d'écriture -> CRUD complet sur
            # la ressource correspondante.
            for resource, actions in PERMISSION_ACTIONS.items():
                if resource in old_keys:
                    for action in actions:
                        new_keys.add(f"{resource}:{action}")

            db.execute(
                text(
                    "UPDATE users SET permissions = :perms, "
                    "legacy_permissions_migrated = TRUE WHERE id = :id"
                ),
                {"perms": ",".join(sorted(new_keys)), "id": user_id},
            )

        db.commit()

    logger.info(
        "Migration des autorisations : %d compte(s) existant(s) mis à niveau vers "
        "le nouveau modèle granulaire (lecture/ajout/modification/suppression).",
        len(rows),
    )
