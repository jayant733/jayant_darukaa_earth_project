from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str = "postgresql+psycopg://darukaa:darukaa@localhost:15432/darukaa"
    jwt_secret: str = "development-secret-change-before-deploying"
    cors_origins: str = "http://localhost:41782"
    access_token_minutes: int = 480

    model_config = SettingsConfigDict(env_file="../.env", extra="ignore")

    @property
    def origins(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",")]


@lru_cache
def get_settings() -> Settings:
    return Settings()
