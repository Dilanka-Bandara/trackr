import asyncio
import json
from abc import ABC, abstractmethod
from collections.abc import AsyncIterator

import boto3
from openai import AsyncOpenAI

from .settings import Settings


class LLMProvider(ABC):
    @abstractmethod
    async def complete(self, system: str, user: str) -> str: ...

    @abstractmethod
    def stream(self, system: str, user: str) -> AsyncIterator[str]: ...

    @abstractmethod
    async def embed(self, texts: list[str]) -> list[list[float]]: ...


class OpenAIProvider(LLMProvider):
    def __init__(self, settings: Settings):
        if not settings.openai_api_key:
            raise ValueError("OPENAI_API_KEY is required for the OpenAI provider")
        self.settings = settings
        self.client = AsyncOpenAI(api_key=settings.openai_api_key, timeout=120, max_retries=2)

    async def complete(self, system: str, user: str) -> str:
        result = await self.client.chat.completions.create(
            model=self.settings.openai_model,
            messages=[{"role": "system", "content": system}, {"role": "user", "content": user}],
            response_format={"type": "json_object"},
            max_completion_tokens=3000,
        )
        return result.choices[0].message.content or ""

    async def stream(self, system: str, user: str) -> AsyncIterator[str]:
        stream = await self.client.chat.completions.create(
            model=self.settings.openai_model,
            messages=[{"role": "system", "content": system}, {"role": "user", "content": user}],
            max_completion_tokens=1800,
            stream=True,
        )
        async for chunk in stream:
            if chunk.choices and chunk.choices[0].delta.content:
                yield chunk.choices[0].delta.content

    async def embed(self, texts: list[str]) -> list[list[float]]:
        result = await self.client.embeddings.create(
            model=self.settings.openai_embedding_model,
            input=[text[:24000] for text in texts],
            dimensions=self.settings.embedding_dim,
        )
        return [item.embedding for item in sorted(result.data, key=lambda item: item.index)]


class BedrockProvider(LLMProvider):
    def __init__(self, settings: Settings):
        self.settings = settings
        self.client = boto3.client("bedrock-runtime", region_name=settings.aws_region)

    def _arguments(self, system: str, user: str) -> dict:
        return {
            "modelId": self.settings.bedrock_model_id,
            "system": [{"text": system}],
            "messages": [{"role": "user", "content": [{"text": user}]}],
            "inferenceConfig": {"maxTokens": 3000},
        }

    async def complete(self, system: str, user: str) -> str:
        result = await asyncio.to_thread(self.client.converse, **self._arguments(system, user))
        return "".join(block.get("text", "") for block in result["output"]["message"]["content"])

    async def stream(self, system: str, user: str) -> AsyncIterator[str]:
        result = await asyncio.to_thread(self.client.converse_stream, **self._arguments(system, user))
        events = iter(result["stream"])
        # A sentinel avoids StopIteration escaping an asyncio Future.
        while (event := await asyncio.to_thread(next, events, None)) is not None:
            text = event.get("contentBlockDelta", {}).get("delta", {}).get("text")
            if text:
                yield text

    async def embed(self, texts: list[str]) -> list[list[float]]:
        vectors = []
        for text in texts:
            result = await asyncio.to_thread(
                self.client.invoke_model,
                modelId=self.settings.bedrock_embedding_model_id,
                body=json.dumps(
                    {"inputText": text[:24000], "dimensions": self.settings.embedding_dim, "normalize": True}
                ),
                contentType="application/json",
                accept="application/json",
            )
            body = await asyncio.to_thread(result["body"].read)
            vectors.append(json.loads(body)["embedding"])
        return vectors
