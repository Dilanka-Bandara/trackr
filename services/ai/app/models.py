from typing import Literal

from pydantic import BaseModel, Field


class ResumeInput(BaseModel):
    text: str = Field(min_length=20, max_length=50000)


class ResumeOutput(BaseModel):
    skills: list[str]
    experience: list[str]
    education: list[str]


class EmbeddingInput(BaseModel):
    texts: list[str] = Field(min_length=1, max_length=16)


class EmbeddingOutput(BaseModel):
    vectors: list[list[float]]


class JobInput(BaseModel):
    resume: str = Field(min_length=1, max_length=50000)
    job: str = Field(min_length=1, max_length=32000)
    tone: Literal["formal", "friendly"] = "formal"
    similarity: float | None = Field(default=None, ge=-1, le=1)


class MatchOutput(BaseModel):
    score: int = Field(ge=0, le=100)
    strengths: list[str] = Field(min_length=1, max_length=10)
    gaps: list[str] = Field(max_length=10)


class Question(BaseModel):
    question: str
    category: str
    tip: str


class QuestionsOutput(BaseModel):
    questions: list[Question] = Field(min_length=3, max_length=12)
