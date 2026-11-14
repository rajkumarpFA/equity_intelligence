"""Application settings loaded from environment variables."""

from functools import lru_cache
from pathlib import Path

from pydantic import Field, SecretStr, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Typed application configuration with secure secret handling."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    app_name: str = "Equity Intelligence"
    app_version: str = "0.1.0"
    app_env: str = "development"
    log_level: str = "INFO"

    database_url: str = Field(
        default="postgresql+psycopg://equity_user:equity_local_password@localhost:5432/equity_intelligence"
    )
    db_pool_size: int = 5
    db_max_overflow: int = 10

    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000,http://localhost:3001,http://127.0.0.1:3001"
    storage_dir: Path = Path("/app/storage")
    max_upload_size_mb: int = 50

    default_price_provider: str = "yahoo_finance"  # 'yahoo_finance' or 'upstox'

    upstox_access_token: SecretStr | None = None
    upstox_analytics_token: SecretStr | None = None
    upstox_api_base_url: str = "https://api.upstox.com/v2"
    upstox_rate_limit_per_sec: int = 5

    @field_validator("storage_dir", mode="before")
    @classmethod
    def _coerce_path(cls, value: str | Path) -> Path:
        return Path(value)

    @property
    def cors_origin_list(self) -> list[str]:
        """Return normalized list of allowed CORS origins."""
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def sanitized_database_url(self) -> str:
        """Return database URL with credentials safely masked."""
        import re
        return re.sub(r"://([^:]+):([^@]+)@", r"://\1:***@", self.database_url)

    @property
    def effective_storage_dir(self) -> Path:
        """Return writable storage directory with local directory fallback when running outside Docker."""
        try:
            self.storage_dir.mkdir(parents=True, exist_ok=True)
            test_file = self.storage_dir / ".write_test"
            test_file.touch()
            test_file.unlink()
            return self.storage_dir
        except (PermissionError, OSError):
            fallback = Path("./storage")
            fallback.mkdir(parents=True, exist_ok=True)
            return fallback

    @property
    def upstox_configured(self) -> bool:
        """Check whether an Upstox token is present without exposing its value."""
        has_access = bool(
            self.upstox_access_token and self.upstox_access_token.get_secret_value().strip()
        )
        has_analytics = bool(
            self.upstox_analytics_token and self.upstox_analytics_token.get_secret_value().strip()
        )
        return has_access or has_analytics


@lru_cache
def get_settings() -> Settings:
    """Return cached settings instance."""
    return Settings()
