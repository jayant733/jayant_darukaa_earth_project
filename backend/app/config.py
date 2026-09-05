from functools import lru_cache
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from pydantic import Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

WEAK_JWT = "development-secret-change-before-deploying"


def normalize_database_url(url: str) -> str:
    """Accept Neon/Render postgres URLs and make them usable by SQLAlchemy + psycopg."""
    value = url.strip().strip('"').strip("'")
    for prefix in ("postgres://", "postgresql://"):
        if value.startswith(prefix) and not value.startswith("postgresql+psycopg://"):
            value = "postgresql+psycopg://" + value[len(prefix) :]
            break
    parts = urlsplit(value)
    query = dict(parse_qsl(parts.query, keep_blank_values=True))
    host = (parts.hostname or "").lower()
    if "neon.tech" in host:
        query.setdefault("sslmode", "require")
    return urlunsplit((parts.scheme, parts.netloc, parts.path, urlencode(query), parts.fragment))


class Settings(BaseSettings):
    database_url: str = "postgresql+psycopg://darukaa:darukaa@localhost:15432/darukaa"
    jwt_secret: str = Field(default=WEAK_JWT, min_length=16)
    cors_origins: str = "http://localhost:41782"
    access_token_minutes: int = 480
    environment: str = "development"

    model_config = SettingsConfigDict(env_file="../.env", extra="ignore")

    @field_validator("database_url")
    @classmethod
    def coerce_database_url(cls, value: str) -> str:
        return normalize_database_url(value)

    @model_validator(mode="after")
    def reject_weak_secret_in_production(self) -> "Settings":
        if self.environment.lower() in {"production", "prod"} and (
            self.jwt_secret == WEAK_JWT or len(self.jwt_secret) < 32
        ):
            raise ValueError("JWT_SECRET must be at least 32 random characters in production")
        return self

    @property
    def origins(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
