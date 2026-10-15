from enum import Enum
from typing import Literal
from uuid import UUID, uuid4

from pydantic import Field

from app.schemas.character import TraitName
from app.schemas.common import StrictModel


class ResourceName(str, Enum):
    TIME = "time"
    MONEY = "money"
    ENERGY = "energy"
    SKILLS = "skills"
    EXPERIENCE = "experience"
    NETWORK = "network"


class ResourceState(StrictModel):
    time: int = Field(default=60, ge=0, le=100)
    money: int = Field(default=50, ge=0, le=100)
    energy: int = Field(default=70, ge=0, le=100)
    skills: int = Field(default=25, ge=0, le=100)
    experience: int = Field(default=10, ge=0, le=100)
    network: int = Field(default=10, ge=0, le=100)


class Effect(StrictModel):
    resource_delta: dict[ResourceName, int] = Field(default_factory=dict)
    trait_delta: dict[TraitName, int] = Field(default_factory=dict)
    add_flags: set[str] = Field(default_factory=set)
    add_achievements: set[str] = Field(default_factory=set)


class Choice(StrictModel):
    id: str = Field(pattern=r"^[a-z0-9_]+$")
    label: str = Field(min_length=1, max_length=120)
    tradeoff_summary: str = Field(min_length=1, max_length=500)
    effects: Effect


class DecisionEvent(StrictModel):
    id: str = Field(pattern=r"^[a-z0-9_]+$")
    round_number: int = Field(ge=1, le=8)
    title: str = Field(min_length=1, max_length=120)
    situation: str = Field(min_length=1, max_length=1000)
    choices: list[Choice] = Field(min_length=2, max_length=4)


class SimulationState(StrictModel):
    id: UUID = Field(default_factory=uuid4)
    round_number: int = Field(default=1, ge=1, le=8)
    selected_pathway_id: UUID
    resources: ResourceState = Field(default_factory=ResourceState)
    flags: set[str] = Field(default_factory=set)
    achievements: set[str] = Field(default_factory=set)
    current_event_id: str
    status: Literal["active", "complete"] = "active"
