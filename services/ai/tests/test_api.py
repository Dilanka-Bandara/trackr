import os

os.environ["AI_INTERNAL_KEY"] = "test-internal-key-with-at-least-32-characters"
os.environ["EMBEDDING_DIM"] = "3"
from fastapi.testclient import TestClient

from app.main import app, get_provider
from app.providers import LLMProvider


class FakeProvider(LLMProvider):
    def __init__(self):
        self.calls = 0
        self.invalid = False

    async def complete(self, system, user):
        self.calls += 1
        if self.invalid:
            return '{"score": 200}'
        if "score" in system:
            return '{"score": 81, "strengths": ["Python experience"], "gaps": ["SQL practice"]}'
        if "questions" in system:
            return '{"questions": [{"question":"Tell me about a project", "category":"role", "tip":"Use evidence"}]}'
        return '{"skills": ["Python"], "experience": [], "education": []}'

    async def stream(self, system, user):
        yield "Dear Hiring Team,"
        yield "\nI am interested in this role."

    async def embed(self, texts):
        return [[0.1, 0.2, 0.3] for _ in texts]


def client():
    fake = FakeProvider()
    app.dependency_overrides[get_provider] = lambda: fake
    return TestClient(app), fake


HEADERS = {"X-Internal-Key": os.environ["AI_INTERNAL_KEY"]}
INPUT = {"resume": "Python developer with five years of experience", "job": "Python engineer"}


def test_requires_internal_key():
    c, _ = client()
    assert c.post("/parse-resume", json={"text": "A developer resume with experience"}).status_code == 401


def test_parse_and_embed():
    c, _ = client()
    assert c.post("/parse-resume", headers=HEADERS, json={"text": INPUT["resume"]}).json()["skills"] == [
        "Python"
    ]
    assert len(c.post("/embed", headers=HEADERS, json={"texts": ["Python"]}).json()["vectors"][0]) == 3


def test_match_validates_range_and_retries_once():
    c, fake = client()
    assert c.post("/match", headers=HEADERS, json=INPUT).json()["score"] == 81
    fake.invalid = True
    fake.calls = 0
    assert c.post("/match", headers=HEADERS, json=INPUT).status_code == 502
    assert fake.calls == 2


def test_stream_and_input_limits():
    c, _ = client()
    assert "Dear Hiring Team" in c.post("/cover-letter/stream", headers=HEADERS, json=INPUT).text
    assert c.post("/embed", headers=HEADERS, json={"texts": []}).status_code == 422
