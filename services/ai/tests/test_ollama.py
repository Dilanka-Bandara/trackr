import json

import httpx
import pytest
from fastapi.testclient import TestClient

from app.main import app, get_provider
from app.ollama import LocalProviderError, OllamaProvider
from app.settings import Settings


def provider(handler):
    settings = Settings(_env_file=None, ai_internal_key="x" * 32, llm_provider="ollama", embedding_dim=3)
    return OllamaProvider(settings, httpx.MockTransport(handler))


@pytest.mark.asyncio
async def test_complete_sends_json_mode_and_preserves_messages():
    def handler(request):
        body = json.loads(request.content)
        assert request.url.path == "/api/chat"
        assert body["format"] == "json" and body["stream"] is False
        assert body["messages"][1]["content"] == "untrusted CV text"
        return httpx.Response(200, json={"message": {"content": '{"skills":["Python"]}'}, "done": True})

    assert "Python" in await provider(handler).complete("Return JSON", "untrusted CV text")


@pytest.mark.asyncio
async def test_stream_joins_chunks_and_requires_completion():
    def handler(request):
        assert json.loads(request.content)["stream"] is True
        return httpx.Response(
            200,
            text='{"message":{"content":"Dear "},"done":false}\n'
            '\n{"message":{"content":"team"},"done":true}\n',
        )

    assert "".join([chunk async for chunk in provider(handler).stream("system", "user")]) == "Dear team"
    broken = provider(lambda _: httpx.Response(200, text='{"message":{"content":"Partial"},"done":false}\n'))
    with pytest.raises(LocalProviderError, match="before generation completed"):
        _ = [chunk async for chunk in broken.stream("system", "user")]


@pytest.mark.asyncio
async def test_embed_requests_exact_dimensions_without_silent_truncation():
    def handler(request):
        assert request.url.path == "/api/embed"
        body = json.loads(request.content)
        assert body["dimensions"] == 3 and body["truncate"] is False
        assert body["input"] == ["CV", "job"]
        return httpx.Response(200, json={"embeddings": [[1, 0, 0], [0, 1, 0]]})

    assert len(await provider(handler).embed(["CV", "job"])) == 2


@pytest.mark.asyncio
@pytest.mark.parametrize("status", [404, 500])
async def test_upstream_http_errors_do_not_leak_content(status):
    local = provider(lambda _: httpx.Response(status, text="private CV text"))
    with pytest.raises(LocalProviderError) as error:
        await local.complete("system", "user")
    assert "private CV" not in str(error.value)


@pytest.mark.asyncio
async def test_unreachable_service_and_malformed_json():
    def offline(request):
        raise httpx.ConnectError("private address", request=request)

    with pytest.raises(LocalProviderError, match="Cannot reach Ollama"):
        await provider(offline).embed(["CV"])
    with pytest.raises(LocalProviderError, match="invalid response"):
        await provider(lambda _: httpx.Response(200, text="not-json")).complete("system", "user")


def test_missing_model_returns_503_even_for_stream():
    local = provider(lambda _: httpx.Response(404, text="private upstream details"))
    previous = app.dependency_overrides.copy()
    app.dependency_overrides[get_provider] = lambda: local
    try:
        from app.settings import get_settings

        with TestClient(app) as client:
            headers = {"X-Internal-Key": get_settings().ai_internal_key}
            data = {"resume": "Python developer", "job": "Backend engineer"}
            for endpoint in ["/match", "/cover-letter/stream"]:
                response = client.post(endpoint, headers=headers, json=data)
                assert response.status_code == 503
                assert "Pull the configured" in response.json()["detail"]
    finally:
        app.dependency_overrides.clear()
        app.dependency_overrides.update(previous)


def test_embedding_dimension_mismatch_is_rejected():
    local = provider(lambda _: httpx.Response(200, json={"embeddings": [[0.5]]}))
    previous = app.dependency_overrides.copy()
    app.dependency_overrides[get_provider] = lambda: local
    try:
        from app.settings import get_settings

        with TestClient(app) as client:
            response = client.post(
                "/embed",
                headers={"X-Internal-Key": get_settings().ai_internal_key},
                json={"texts": ["Developer"]},
            )
            assert response.status_code == 502
    finally:
        app.dependency_overrides.clear()
        app.dependency_overrides.update(previous)
