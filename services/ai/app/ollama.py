"""Local Ollama adapter. No paid fallback or generated placeholder results."""

import json
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

import httpx
from pydantic import BaseModel, ConfigDict, ValidationError

from .providers import LLMProvider
from .settings import Settings


class LocalProviderError(Exception):
    """A safe diagnostic that contains no CV text or upstream response body."""


class Message(BaseModel):
    content: str


class ChatResponse(BaseModel):
    model_config = ConfigDict(strict=True)
    message: Message
    done: bool


class EmbeddingsResponse(BaseModel):
    embeddings: list[list[float]]


class OllamaProvider(LLMProvider):
    def __init__(self, settings: Settings, transport: httpx.AsyncBaseTransport | None = None):
        self.settings = settings
        self.transport = transport

    @asynccontextmanager
    async def client(self):
        try:
            async with httpx.AsyncClient(
                base_url=str(self.settings.ollama_base_url).rstrip("/") + "/",
                timeout=httpx.Timeout(self.settings.ollama_timeout_seconds, connect=10),
                transport=self.transport,
                trust_env=False,
            ) as client:
                yield client
        except httpx.TimeoutException as exc:
            raise LocalProviderError(
                "Local AI timed out. Try a smaller model or a shorter document."
            ) from exc
        except httpx.HTTPStatusError as exc:
            message = (
                "Local AI model was not found. Pull the configured Ollama model first."
                if exc.response.status_code == 404
                else "Ollama rejected the request. Check the selected model and local service logs."
            )
            raise LocalProviderError(message) from exc
        except httpx.RequestError as exc:
            raise LocalProviderError("Cannot reach Ollama. Start it and check OLLAMA_BASE_URL.") from exc
        except (ValidationError, json.JSONDecodeError) as exc:
            raise LocalProviderError("Ollama returned an invalid response.") from exc

    def chat_body(self, system: str, user: str, stream: bool) -> dict:
        return {
            "model": self.settings.ollama_model,
            "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}],
            "stream": stream,
            "options": {"temperature": 0.2, "num_predict": 3000 if not stream else 1800},
        }

    async def complete(self, system: str, user: str) -> str:
        async with self.client() as client:
            response = await client.post(
                "api/chat", json={**self.chat_body(system, user, False), "format": "json"}
            )
            response.raise_for_status()
            result = ChatResponse.model_validate(response.json())
            if not result.done or not result.message.content.strip():
                raise LocalProviderError("Ollama did not return a complete answer.")
            return result.message.content

    async def stream(self, system: str, user: str) -> AsyncIterator[str]:
        async with (
            self.client() as client,
            client.stream("POST", "api/chat", json=self.chat_body(system, user, True)) as response,
        ):
            response.raise_for_status()
            received_text = False
            async for line in response.aiter_lines():
                if not line.strip():
                    continue
                result = ChatResponse.model_validate_json(line)
                if result.message.content:
                    received_text = True
                    yield result.message.content
                if result.done:
                    if not received_text:
                        raise LocalProviderError("Ollama returned an empty answer.")
                    return
            raise LocalProviderError("Ollama's response ended before generation completed.")

    async def embed(self, texts: list[str]) -> list[list[float]]:
        async with self.client() as client:
            response = await client.post(
                "api/embed",
                json={
                    "model": self.settings.ollama_embedding_model,
                    "input": texts,
                    "truncate": False,
                    "dimensions": self.settings.embedding_dim,
                },
            )
            response.raise_for_status()
            return EmbeddingsResponse.model_validate(response.json()).embeddings
