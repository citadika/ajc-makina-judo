"""
Configuration centralisée de l'application, lue depuis les variables
d'environnement (fichier .env en développement).

Equivalent Python de application.properties côté backend Java.
"""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # -------------------------------------------------------
    # POSTGRESQL
    # -------------------------------------------------------
    db_host: str = "localhost"
    db_port: int = 5432
    db_name: str = "ajc_makina_judo"
    db_username: str = "postgres"
    db_password: str = "admin1"

    @property
    def database_url(self) -> str:
        return (
            f"postgresql+psycopg2://{self.db_username}:{self.db_password}"
            f"@{self.db_host}:{self.db_port}/{self.db_name}"
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
    # aléatoire (ex: openssl rand -base64 48).
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
