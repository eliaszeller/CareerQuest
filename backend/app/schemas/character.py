from __future__ import annotations

from datetime import date
from enum import Enum
from typing import Literal, Optional
from uuid import UUID, uuid4

from pydantic import Field, model_validator

from app.schemas.common import StrictModel


class LifeStage(str, Enum):
    HIGH_SCHOOL = "high_school"
    COLLEGE = "college"
    GRADUATE = "graduate_or_professional"
    WORKFORCE = "workforce"


class TraitName(str, Enum):
    COMMUNICATION = "communication"
    LEADERSHIP = "leadership"
    CREATIVITY = "creativity"
    TECHNICAL = "technical_ability"
    ANALYTICAL = "analytical_thinking"
    ADAPTABILITY = "adaptability"
    COLLABORATION = "collaboration"
    ORGANIZATION = "organization"
    READINESS = "career_readiness"
    NETWORK = "professional_network"
    WELLBEING = "energy_and_wellbeing"


class Provenance(StrictModel):
    kind: Literal["user", "resume", "score_report", "curated", "ai", "rule"]
    evidence: Optional[str] = Field(default=None, max_length=500)
    source_id: Optional[str] = Field(default=None, max_length=100)
    confidence: Optional[float] = Field(default=None, ge=0, le=1)


class Trait(StrictModel):
    name: TraitName
    value: int = Field(ge=0, le=10)
    rationale: str = Field(min_length=1, max_length=500)
    evidence: list[Provenance] = Field(default_factory=list, max_length=10)
    user_edited: bool = False


class StandardizedTestScore(StrictModel):
    exam: Literal["ACT", "SAT"]
    test_date: Optional[date] = None
    composite_or_total: int
    sections: dict[str, int] = Field(default_factory=dict)
    superscore: bool = False
    provenance: Literal["user_entered", "uploaded_report"]
    verified_by_user: bool = False

    @model_validator(mode="after")
    def validate_total(self) -> StandardizedTestScore:
        valid = (
            1 <= self.composite_or_total <= 36
            if self.exam == "ACT"
            else 400 <= self.composite_or_total <= 1600
        )
        if not valid:
            expected = "1–36" if self.exam == "ACT" else "400–1600"
            raise ValueError(f"{self.exam} total must be in the range {expected}")
        return self


EntryCategory = Literal[
    "education",
    "experience",
    "skills",
    "interests",
    "classes",
    "hobbies",
    "projects",
    "certifications",
]


class CharacterEntry(StrictModel):
    """The same editable record for manual input and extracted suggestions."""

    id: UUID = Field(default_factory=uuid4)
    category: EntryCategory
    title: str = Field(min_length=1, max_length=160)
    details: str = Field(default="", max_length=2000)
    source: Literal["manual", "resume"] = "manual"
    status: Literal["suggested", "confirmed"] = "confirmed"
    evidence: Optional[str] = Field(default=None, max_length=500)


class CharacterProfile(StrictModel):
    schema_version: Literal["2.0"] = "2.0"
    id: UUID = Field(default_factory=uuid4)
    name: str = Field(default="", max_length=80)
    life_stage: Optional[LifeStage] = None
    goal: str = Field(default="", max_length=500)
    entries: list[CharacterEntry] = Field(default_factory=list, max_length=200)
    approval_status: Literal["draft", "approved"] = "draft"

    @model_validator(mode="after")
    def validate_review(self) -> CharacterProfile:
        if len({entry.id for entry in self.entries}) != len(self.entries):
            raise ValueError("Each entry must have a unique ID.")
        if self.approval_status == "approved":
            if not self.name or self.life_stage is None:
                raise ValueError("Add a name and life stage before approving your character.")
            if any(entry.status != "confirmed" for entry in self.entries):
                raise ValueError("Confirm or remove every suggestion before approving.")
        return self
