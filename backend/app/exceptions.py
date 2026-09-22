"""
Exceptions métier + gestionnaires globaux.

Equivalent Python de cd.ajcmakina.judocard.exception.* +
GlobalExceptionHandler.java : chaque exception métier est traduite
en code HTTP approprié avec un corps JSON cohérent (ApiError),
plutôt que de laisser remonter un 500 générique pour tout.
"""

from datetime import datetime, timezone

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy.exc import OperationalError, SQLAlchemyError

from app.schemas import ApiError


class ResourceNotFoundException(Exception):
    def __init__(self, message: str):
        self.message = message


class ConflictException(Exception):
    def __init__(self, message: str):
        self.message = message


class BadRequestException(Exception):
    def __init__(self, message: str):
        self.message = message


class UnauthorizedException(Exception):
    def __init__(self, message: str):
        self.message = message


class ForbiddenException(Exception):
    def __init__(self, message: str):
        self.message = message


def _build_error(
    status_code: int, message: str, path: str, details: list[str] | None = None
) -> JSONResponse:
    body = ApiError(
        status=status_code,
        error=_reason_phrase(status_code),
        message=message,
        path=path,
        timestamp=datetime.now(timezone.utc),
        details=details,
    )
    return JSONResponse(
        status_code=status_code,
        content=body.model_dump(mode="json"),
    )


def _reason_phrase(status_code: int) -> str:
    phrases = {
        400: "Bad Request",
        401: "Unauthorized",
        403: "Forbidden",
        404: "Not Found",
        409: "Conflict",
        413: "Payload Too Large",
        422: "Bad Request",
        500: "Internal Server Error",
        503: "Service Unavailable",
    }
    return phrases.get(status_code, "Error")


def register_exception_handlers(app: FastAPI) -> None:

    @app.exception_handler(ResourceNotFoundException)
    async def handle_not_found(request: Request, exc: ResourceNotFoundException):
        return _build_error(status.HTTP_404_NOT_FOUND, exc.message, request.url.path)

    @app.exception_handler(ConflictException)
    async def handle_conflict(request: Request, exc: ConflictException):
        return _build_error(status.HTTP_409_CONFLICT, exc.message, request.url.path)

    @app.exception_handler(BadRequestException)
    async def handle_bad_request(request: Request, exc: BadRequestException):
        return _build_error(status.HTTP_400_BAD_REQUEST, exc.message, request.url.path)

    @app.exception_handler(UnauthorizedException)
    async def handle_unauthorized(request: Request, exc: UnauthorizedException):
        return _build_error(
            status.HTTP_401_UNAUTHORIZED, exc.message, request.url.path
        )

    @app.exception_handler(ForbiddenException)
    async def handle_forbidden(request: Request, exc: ForbiddenException):
        return _build_error(status.HTTP_403_FORBIDDEN, exc.message, request.url.path)

    # 400 - Validation @Valid (body / multipart part) invalide.
    @app.exception_handler(RequestValidationError)
    async def handle_validation(request: Request, exc: RequestValidationError):
        details = [
            f"{'.'.join(str(loc) for loc in error['loc'])} : {error['msg']}"
            for error in exc.errors()
        ]
        return _build_error(
            status.HTTP_400_BAD_REQUEST,
            "Données invalides.",
            request.url.path,
            details=details,
        )

    # 503 - Base de données injoignable / connexion perdue.
    #
    # Distingue les pannes de connexion PostgreSQL (perte réseau,
    # connexion coupée après inactivité, timeout...) des vraies
    # erreurs applicatives, pour que le frontend puisse afficher un
    # message clair plutôt qu'une "erreur inattendue" générique.
    @app.exception_handler(OperationalError)
    async def handle_db_unavailable(request: Request, exc: OperationalError):
        return _build_error(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "Problème temporaire de connexion à la base de données. "
            "Merci de réessayer dans un instant.",
            request.url.path,
        )

    @app.exception_handler(SQLAlchemyError)
    async def handle_sqlalchemy_error(request: Request, exc: SQLAlchemyError):
        return _build_error(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "Problème temporaire de connexion à la base de données. "
            "Merci de réessayer dans un instant.",
            request.url.path,
        )

    # 500 - Filet de sécurité générique. On loggue la trace complète
    # côté serveur mais on ne renvoie jamais le détail technique au
    # client.
    @app.exception_handler(Exception)
    async def handle_generic(request: Request, exc: Exception):
        import logging

        logging.getLogger("judocard").exception(
            "Erreur inattendue sur %s %s", request.method, request.url.path
        )
        return _build_error(
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            "Une erreur inattendue est survenue. "
            "Merci de réessayer ou de contacter l'administrateur.",
            request.url.path,
        )
