from functools import lru_cache
from typing import Literal

from pydantic import Field, HttpUrl
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=("../../.env", ".env"), extra="ignore")
    ai_internal_key: str = Field(min_length=32)
    llm_provider: Literal["openai", "bedrock", "ollama"] = "openai"
    ollama_base_url: HttpUrl = "http://127.0.0.1:11434"
    ollama_model: str = Field(default="qwen2.5:7b", min_length=1)
    ollama_embedding_model: str = Field(default="qwen3-embedding:0.6b", min_length=1)
    ollama_timeout_seconds: float = Field(default=120, gt=0, le=150)
    openai_api_key: str = ""
    openai_model: str = "gpt-4.1-mini"
    openai_embedding_model: str = "text-embedding-3-large"
    embedding_dim: int = Field(default=1024, gt=0)
    aws_region: str = "us-east-1"
    bedrock_model_id: str = "anthropic.claude-3-5-sonnet-20241022-v2:0"
    bedrock_embedding_model_id: str = "amazon.titan-embed-text-v2:0"
    sentry_dsn: str = ""
    otel_exporter_otlp_endpoint: str = ""


@lru_cache
def get_settings() -> Settings:
    return Settings()
