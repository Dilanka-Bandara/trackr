import hmac
import logging
import math
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Annotated

import sentry_sdk
from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.responses import StreamingResponse
from opentelemetry import trace
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from pydantic import BaseModel, ValidationError

from .models import (
    EmbeddingInput,
    EmbeddingOutput,
    JobInput,
    MatchOutput,
    QuestionsOutput,
    ResumeInput,
    ResumeOutput,
)
from .providers import BedrockProvider, LLMProvider, OpenAIProvider
from .settings import get_settings

logger = logging.getLogger("trackr.ai")
PROMPTS = Path(__file__).parent / "prompts"


@asynccontextmanager
async def lifespan(_app: FastAPI):
    settings = get_settings()  # Validate required environment before serving requests.
    if settings.sentry_dsn:
        sentry_sdk.init(dsn=settings.sentry_dsn)
    provider = None
    if settings.otel_exporter_otlp_endpoint:
        provider = TracerProvider()
        provider.add_span_processor(
            BatchSpanProcessor(
                OTLPSpanExporter(endpoint=settings.otel_exporter_otlp_endpoint.rstrip("/") + "/v1/traces")
            )
        )
        trace.set_tracer_provider(provider)
    yield
    if provider:
        provider.shutdown()


def authorize(x_internal_key: Annotated[str, Header()] = ""):
    if not hmac.compare_digest(x_internal_key, get_settings().ai_internal_key):
        raise HTTPException(401, "Invalid internal key")


def get_provider() -> LLMProvider:
    settings = get_settings()
    try:
        return OpenAIProvider(settings) if settings.llm_provider == "openai" else BedrockProvider(settings)
    except ValueError as exc:
        raise HTTPException(503, str(exc)) from exc


app = FastAPI(title="Trackr internal AI", lifespan=lifespan)
FastAPIInstrumentor.instrument_app(app)
Provider = Annotated[LLMProvider, Depends(get_provider)]
auth = [Depends(authorize)]


async def structured[T: BaseModel](provider: LLMProvider, prompt: str, data: BaseModel, output: type[T]) -> T:
    system = (PROMPTS / prompt).read_text(encoding="utf-8")
    for attempt in range(2):
        raw = await provider.complete(system, data.model_dump_json())
        try:
            return output.model_validate_json(raw)
        except ValidationError:
            if attempt:
                raise HTTPException(502, "The AI provider returned invalid structured output") from None
            system += "\nYour previous output was invalid. Return only JSON matching the requested schema."
    raise HTTPException(502, "Invalid response")


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/parse-resume", response_model=ResumeOutput, dependencies=auth)
async def parse_resume(body: ResumeInput, provider: Provider):
    return await structured(provider, "resume.txt", body, ResumeOutput)


@app.post("/embed", response_model=EmbeddingOutput, dependencies=auth)
async def embed(body: EmbeddingInput, provider: Provider):
    if any(not text.strip() or len(text) > 50000 for text in body.texts):
        raise HTTPException(422, "Each text must contain 1 to 50000 characters")
    vectors = await provider.embed(body.texts)
    if len(vectors) != len(body.texts) or any(
        len(v) != get_settings().embedding_dim or any(not math.isfinite(x) for x in v) for v in vectors
    ):
        raise HTTPException(502, "Invalid embedding dimensions or values")
    return EmbeddingOutput(vectors=vectors)


@app.post("/match", response_model=MatchOutput, dependencies=auth)
async def match(body: JobInput, provider: Provider):
    return await structured(provider, "match.txt", body, MatchOutput)


@app.post("/interview-questions", response_model=QuestionsOutput, dependencies=auth)
async def questions(body: JobInput, provider: Provider):
    return await structured(provider, "interview.txt", body, QuestionsOutput)


@app.post("/cover-letter/stream", dependencies=auth)
async def cover_letter(body: JobInput, provider: Provider):
    return StreamingResponse(
        provider.stream((PROMPTS / "cover-letter.txt").read_text(), body.model_dump_json()),
        media_type="text/plain",
    )
