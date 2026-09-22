"""
Point d'entrée de l'application JudoCard (backend FastAPI).

Equivalent Python de JudocardBackendApplication.java + DataInitializer.java
(création automatique des tables et du compte admin par défaut au
démarrage) + SecurityConfig.java (CORS) + StaticResourceConfig.java
(fichiers uploadés servis publiquement sous /uploads).

Lancement (développement) :

    uvicorn app.main:app --reload --port 8000

Au premier démarrage, les tables sont créées automatiquement dans la
base PostgreSQL configurée (voir app/config.py / .env), et un compte
administrateur par défaut est créé s'il n'existe pas déjà :

    username = admin
    password = Admin@123
    email    = admin@judoclub.com

Pensez à changer ce mot de passe par défaut une fois en production.
"""

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.database import Base, SessionLocal, engine
from app.exceptions import register_exception_handlers
from app.migrations import run_lightweight_migrations, upgrade_legacy_permissions
from app.models import User
from app.routers import (
    activity_log,
    auth,
    belt_history,
    cards,
    examiners,
    members,
    settings as settings_router,
    users,
    verifications,
)
from app.security import hash_password
from app.utils.uploads import UPLOAD_ROOT

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("judocard")

app = FastAPI(
    title="JudoCard API",
    description="API de gestion des cartes de membre pour un club de judo.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept"],
    expose_headers=["Authorization"],
)

register_exception_handlers(app)

# Fichiers uploadés (photos de membres, logo du club) : ressources
# publiques, servies sans authentification - comme /uploads/** côté
# Spring Boot (StaticResourceConfig.java).
app.mount("/uploads", StaticFiles(directory=str(UPLOAD_ROOT)), name="uploads")

app.include_router(auth.router)
app.include_router(members.router)
app.include_router(belt_history.router)
app.include_router(cards.router)
app.include_router(users.router)
app.include_router(settings_router.router)
app.include_router(verifications.router)
app.include_router(activity_log.router)
app.include_router(examiners.router)


def _init_default_admin() -> None:

    db = SessionLocal()

    try:
        existing = db.query(User).filter(User.username == "admin").first()

        if existing is not None:
            return

        admin = User(
            username="admin",
            email="admin@judoclub.com",
            full_name="Administrateur",
            password_hash=hash_password("Admin@123"),
            role="ADMIN",
            enabled=True,
        )

        db.add(admin)
        db.commit()

        logger.info(
            "Compte ADMIN par défaut créé (username=admin, "
            "email=admin@judoclub.com). Pensez à changer le mot de "
            "passe par défaut."
        )

    finally:
        db.close()


@app.on_event("startup")
def on_startup() -> None:

    # ddl-auto=update côté Java <-> create_all() côté Python : crée
    # les tables manquantes sans toucher aux tables/données
    # existantes. Comme côté Java, ce n'est pas recommandé en
    # production (envisager Alembic pour des migrations maîtrisées),
    # mais convient parfaitement au développement.
    Base.metadata.create_all(bind=engine)

    # Rattrape les colonnes ajoutées à des tables déjà existantes
    # (create_all() ci-dessus ne le fait jamais) - voir
    # app/migrations.py pour le détail et la raison d'être.
    run_lightweight_migrations(engine)

    _init_default_admin()

    # Met à niveau les comptes déjà existants vers le nouveau modèle
    # d'autorisations granulaires (lecture/ajout/modification/
    # suppression séparées) sans rien leur retirer - voir
    # app/migrations.py, upgrade_legacy_permissions(). Doit s'exécuter
    # après run_lightweight_migrations() (qui crée la colonne
    # nécessaire) et peut s'exécuter à chaque démarrage sans risque
    # (idempotent).
    upgrade_legacy_permissions(engine)


@app.get("/", tags=["health"])
def health_check() -> dict:
    return {"status": "ok", "service": "judocard-backend"}
