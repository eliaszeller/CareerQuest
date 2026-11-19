from typing import Annotated, Literal, Optional

from pydantic import Field, model_validator

from app.schemas.common import StrictModel

CareerCategory = Literal[
    "Healthcare", "Business", "Education", "Military", "Law", "Trades", "Political"
]
Rating = Annotated[int, Field(strict=True, ge=1, le=5)]


class SurveySubmission(StrictModel):
    version: Literal["careerquest-survey-1.0"]
    answers: dict[str, Optional[Rating]]

    @model_validator(mode="after")
    def complete_question_set(self):
        if set(self.answers) != {f"q{i:02}" for i in range(1, 31)}:
            raise ValueError("Answer each of the 30 questions, or choose Not sure yet.")
        return self


class CareerSignal(StrictModel):
    category: CareerCategory
    score: Optional[float]
    answered_items: int
    reasons: list[str]


class Preference(StrictModel):
    question_id: str
    text: str
    response: Optional[int]


class SurveyResult(StrictModel):
    version: Literal["careerquest-survey-1.0"] = "careerquest-survey-1.0"
    answered_count: int
    not_sure_count: int
    has_direction: bool
    careers: list[CareerSignal]
    learning: list[Preference]
    location: list[Preference]
