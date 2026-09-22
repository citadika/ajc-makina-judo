"""
Configuration centralisée de l'application, lue depuis les variables
d'environnement (fichier .env en développement).

Equivalent Python de application.properties côté backend Java.
"""

from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy.engine import URL


class Settings(BaseSettings):

    model_config = SettingsConfigDict(
        env_file=".env",
        extra="ignore"
    )

    # -------------------------------------------------------
    # POSTGRESQL
    # -------------------------------------------------------
    db_host: str = "localhost"
    db_port: int = 5432
    db_name: str = "ajc_makina_judo"
    db_username: str = "postgres"
    db_password: str = "admin1"

    @property
    def database_url(self):
        """
        Construit l'URL SQLAlchemy de manière sécurisée.

        URL.create() permet notamment de gérer correctement les
        caractères spéciaux présents dans le mot de passe.
        """
        return URL.create(
            drivername="postgresql+psycopg2",
            username=self.db_username,
            password=self.db_password,
            host=self.db_host,
            port=self.db_port,
            database=self.db_name,
        )

    # -------------------------------------------------------
    # SERVEUR
    # -------------------------------------------------------
    server_port: int = 8000

    # -------------------------------------------------------
    # JWT
    # -------------------------------------------------------
    #
    # Valeur par défaut fournie pour le développement uniquement.
    # En production, définir OBLIGATOIREMENT la variable
    # d'environnement JWT_SECRET avec une valeur longue et
    # aléatoire.
    jwt_secret: str = (
        "JudoCardSystemSecretKey2026VerySecureKeyForJWT123456789"
    )
    jwt_algorithm: str = "HS256"
    jwt_expiration_hours: int = 24

    # -------------------------------------------------------
    # CORS
    # -------------------------------------------------------
    #
    # Origine(s) autorisées à appeler l'API (le frontend React /
    # Vite). Plusieurs origines : séparées par une virgule.
    cors_allowed_origins: str = "http://localhost:5173"

    @property
    def cors_origins_list(self) -> list[str]:
        return [
            origin.strip()
            for origin in self.cors_allowed_origins.split(",")
            if origin.strip()
        ]

    # -------------------------------------------------------
    # UPLOADS
    # -------------------------------------------------------
    max_upload_size_bytes: int = 5 * 1024 * 1024  # 5 Mo


settings = Settings()

