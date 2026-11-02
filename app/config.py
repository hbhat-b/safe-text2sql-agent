from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """App settings, loaded from environment variables or a .env file."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Any OpenAI-compatible endpoint works: OpenAI, Azure OpenAI, Groq, Ollama, etc.
    llm_api_key: str = "not-set"
    llm_base_url: str | None = None
    llm_model: str = "gpt-4o-mini"
    llm_temperature: float = 0.0

    db_path: str = "data/chinook.sqlite"
    max_retries: int = 2
    row_limit: int = 100


@lru_cache
def get_settings() -> Settings:
    return Settings()
