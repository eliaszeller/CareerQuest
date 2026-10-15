from typing import Literal

from pydantic import BaseModel, ConfigDict


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class ServiceStatus(StrictModel):
    name: str
    configured: bool
    required: bool


class HealthResponse(StrictModel):
    status: Literal["ok"] = "ok"
    service: str
    version: str
    models: list[ServiceStatus]

