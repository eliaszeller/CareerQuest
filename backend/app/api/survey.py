from fastapi import APIRouter, Response

from app.schemas.survey import SurveyResult, SurveySubmission
from app.services.survey import score_survey

router = APIRouter(prefix="/survey", tags=["survey"])


@router.post("/results", response_model=SurveyResult)
def results(submission: SurveySubmission, response: Response) -> SurveyResult:
    response.headers["Cache-Control"] = "no-store"
    return score_survey(submission)
