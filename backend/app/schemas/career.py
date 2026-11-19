from __future__ import annotations

from typing import Literal, Optional

from pydantic import Field

from app.schemas.common import StrictModel
from app.schemas.survey import CareerCategory

SOC_PATTERN = r"^\d{2}-\d{4}\.\d{2}$"
# O*NET Importance runs 1-5; 3 is "Important". At or above it we call a rating required.
REQUIRED_IMPORTANCE = 3.0


class DataSource(StrictModel):
    name: str
    version: str
    license: str
    license_url: str
    attribution: str


class SkillRating(StrictModel):
    element_id: str
    name: str
    importance: Optional[float] = Field(default=None, ge=1, le=5)
    level: Optional[float] = Field(default=None, ge=0, le=7)
    required: bool


class SoftwareSkill(StrictModel):
    name: str
    category: str
    hot_technology: bool
    in_demand: bool


class RelatedOccupation(StrictModel):
    soc: str
    title: str
    tier: str


class JobZone(StrictModel):
    zone: int = Field(ge=1, le=5)
    name: Optional[str] = None
    education: Optional[str] = None
    experience: Optional[str] = None
    training: Optional[str] = None


class OccupationSummary(StrictModel):
    soc: str
    title: str
    job_zone: Optional[int] = None
    matched_title: str


class SalaryRange(StrictModel):
    postings_with_salary: int
    p25: float
    median: float
    p75: float


class PreferredSkill(StrictModel):
    name: str
    share: float = Field(ge=0, le=1)
    in_onet: bool


class PostingSummary(StrictModel):
    job_id: str
    soc: str
    title: str
    company: Optional[str] = None
    location: Optional[str] = None
    experience_level: Optional[str] = None
    work_type: Optional[str] = None
    salary_annual: Optional[float] = None
    listed_date: Optional[str] = None
    url: Optional[str] = None
    snippet: str
    score: Optional[float] = None


class MarketSummary(StrictModel):
    postings: int
    salary: Optional[SalaryRange] = None
    preferred_skills: list[PreferredSkill]
    sample_postings: list[PostingSummary]
    source: DataSource


class OccupationDetail(StrictModel):
    soc: str
    title: str
    description: str
    alternate_titles: list[str]
    job_zone: Optional[JobZone] = None
    essential_skills: list[SkillRating]
    transferable_skills: list[SkillRating]
    knowledge: list[SkillRating]
    software: list[SoftwareSkill]
    related: list[RelatedOccupation]
    source: DataSource
    market: Optional[MarketSummary] = None


class CareerSearchResponse(StrictModel):
    query: str
    results: list[OccupationSummary]
    source: DataSource


class CareerExploreResponse(StrictModel):
    category: CareerCategory
    results: list[OccupationSummary]
    source: DataSource


class SkillNormalizeRequest(StrictModel):
    skills: list[str] = Field(max_length=200)


class SkillMatch(StrictModel):
    label: str
    onet_name: Optional[str] = None
    match: Literal["exact", "alias", "none"]


class SkillNormalizeResponse(StrictModel):
    matches: list[SkillMatch]
    source: DataSource


class CategoryGuess(StrictModel):
    category: str
    label: str
    confidence: float = Field(ge=0, le=1)
    model_version: str


class OccupationSuggestion(StrictModel):
    soc: str
    title: str
    score: Optional[float] = None
    reason: Literal["similar_wording", "resume_category"]


class CareerSuggestions(StrictModel):
    categories: list[CategoryGuess]
    occupations: list[OccupationSuggestion]
    note: str
    source: Optional[DataSource] = None


class PostingSearchRequest(StrictModel):
    query: str = Field(min_length=2, max_length=2000)
    soc: Optional[str] = Field(default=None, pattern=SOC_PATTERN)
    limit: int = Field(default=10, ge=1, le=50)


class PostingSearchResponse(StrictModel):
    results: list[PostingSummary]
    method: Literal["tfidf_index", "title_match"]
    source: DataSource


class SkillGapRequest(StrictModel):
    soc: str = Field(pattern=SOC_PATTERN)
    skills: list[str] = Field(default_factory=list, max_length=200)


class GapItem(StrictModel):
    name: str
    kind: Literal["required", "transferable", "software", "preferred"]
    have: bool
    matched_by: Optional[str] = None
    detail: Optional[str] = None


class SkillGapResponse(StrictModel):
    soc: str
    title: str
    coverage: Optional[float] = Field(default=None, ge=0, le=1)
    items: list[GapItem]
    note: str
    sources: list[DataSource]


class ExplainRequest(StrictModel):
    soc: str = Field(pattern=SOC_PATTERN)
    skills: list[str] = Field(default_factory=list, max_length=200)
    goal: Optional[str] = Field(default=None, max_length=200)


class ExplanationFact(StrictModel):
    id: str
    text: str
    source: str


class ExplanationPoint(StrictModel):
    text: str
    facts: list[str] = Field(min_length=1)


class CareerExplanation(StrictModel):
    soc: str
    title: str
    summary: str
    points: list[ExplanationPoint]
    facts: list[ExplanationFact]
    generated_by: Literal["model", "template"]
    model: Optional[str] = None
    note: str
    sources: list[DataSource]
