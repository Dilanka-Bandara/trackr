"""CI-only provider double. Never used by the normal application entry point."""

import json
import os

from app.main import app, get_provider
from app.providers import LLMProvider
from app.settings import get_settings

if os.environ.get("TRACKR_TEST_AI") != "1":
    raise RuntimeError("This test server requires TRACKR_TEST_AI=1")


class TestProvider(LLMProvider):
    async def complete(self, system, user):
        if "score" in system:
            return json.dumps({"score": 81, "strengths": ["TypeScript experience"], "gaps": ["Practice SQL"]})
        if "questions" in system:
            return json.dumps(
                {
                    "questions": [
                        {
                            "question": f"Describe project {i + 1}",
                            "category": "role",
                            "tip": "Use evidence from your experience",
                        }
                        for i in range(6)
                    ]
                }
            )
        return json.dumps(
            {
                "skills": ["TypeScript", "React", "PostgreSQL"],
                "experience": ["Built accessible web applications"],
                "education": [],
            }
        )

    async def stream(self, system, user):
        for part in [
            "Dear Hiring Team,\n\n",
            "This is a test-provider cover letter. ",
            "I bring TypeScript and React experience.\n\nBest regards",
        ]:
            yield part

    async def embed(self, texts):
        return [[1.0] + [0.0] * (get_settings().embedding_dim - 1) for _ in texts]


app.dependency_overrides[get_provider] = TestProvider
