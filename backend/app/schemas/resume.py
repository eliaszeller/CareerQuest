from __future__ import annotations

from typing import Optional

from pydantic import Field

from app.schemas.common import StrictModel


class ResumeDraft(StrictModel):
    name: Optional[str] = Field(default=None, max_length=100)
    education: list[str] = Field(default_factory=list)
    experience: list[str] = Field(default_factory=list)
    skills: list[str] = Field(default_factory=list)
    certifications: list[str] = Field(default_factory=list)
    projects: list[str] = Field(default_factory=list)


class ResumeUploadResponse(StrictModel):
    filename: str
    character_count: int
    draft: ResumeDraft
    review_required: bool = True
    message: str
