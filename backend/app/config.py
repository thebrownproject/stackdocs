"""Application configuration using environment variables"""

from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache


class Settings(BaseSettings):
    """Application settings loaded from environment variables"""

    # Supabase Configuration
    SUPABASE_URL: str
    SUPABASE_KEY: str  # Service role key for backend operations

    # Anthropic API Configuration (for extraction)
    ANTHROPIC_API_KEY: str
    CLAUDE_MODEL: str = "claude-haiku-4-5"

    # Mistral API Configuration (for OCR)
    MISTRAL_API_KEY: str

    # Clerk Configuration (for auth)
    CLERK_SECRET_KEY: str
    CLERK_AUTHORIZED_PARTIES: str = "https://www.stackdocs.io"  # Comma-separated

    # Application Configuration
    APP_NAME: str = "Stackdocs MVP"
    APP_VERSION: str = "0.2.0"  # Bumped for hybrid architecture migration
    ENVIRONMENT: str = "development"
    DEBUG: bool = False

    # CORS Configuration
    ALLOWED_ORIGINS: str = "http://localhost:3000"  # Frontend URL (comma-separated for multiple)

    model_config = SettingsConfigDict(  # pyright: ignore[reportUnannotatedClassAttribute]
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True
    )


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance"""
    return Settings()  # pyright: ignore[reportCallIssue]
