"""
Connexion SQLAlchemy à PostgreSQL.

Equivalent Python de la configuration HikariCP du backend Java
(application.properties, section "Pool de connexions") : les
réglages ci-dessous évitent qu'une connexion coupée côté serveur
(après une période d'inactivité) soit distribuée à l'application et
fasse échouer une requête avec une erreur générique.

- pool_pre_ping=True : vérifie chaque connexion avant de la donner
  à l'application (équivalent de connection-test-query côté Hikari).
- pool_recycle=270 : recycle une connexion avant qu'elle n'atteigne
  270 secondes (mêmes valeurs que max-lifetime côté Hikari), pour
  la renouveler avant qu'un hébergeur distant ne la coupe lui-même.
- pool_size / max_overflow : équivalents de maximum-pool-size /
  minimum-idle.
"""

from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import settings

engine = create_engine(
    settings.database_url,
    pool_pre_ping=True,
    pool_recycle=270,
    pool_size=10,
    max_overflow=0,
    connect_args={"connect_timeout": 30},
)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
)


class Base(DeclarativeBase):
    pass


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
