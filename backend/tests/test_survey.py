import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.main import app
from app.schemas.survey import SurveySubmission
from app.services.survey import CATALOG, score_survey


def submission(value=3, **overrides):
    return SurveySubmission(
        version=CATALOG["version"],
        answers={
            **{f"q{i:02}": value for i in range(1, 31)},
            **overrides,
        },
    )


@pytest.mark.parametrize("value", [None, 1, 3, 5])
def test_flat_responses_never_pick_arbitrary_winner(value):
    result = score_survey(submission(value))
    assert not result.has_direction
    assert len(result.careers) == 7
    assert [c.category for c in result.careers] == sorted(c["id"] for c in CATALOG["careers"])
    assert result.answered_count + result.not_sure_count == 30


@pytest.mark.parametrize("bad", [0, 6, True, "3", 2.5])
def test_ratings_are_strict(bad):
    with pytest.raises(ValidationError):
        submission(q01=bad)


def test_exact_question_set_required():
    data = submission().model_dump()
    del data["answers"]["q30"]
    with pytest.raises(ValidationError):
        SurveySubmission(**data)
    data["answers"]["unknown"] = 4
    with pytest.raises(ValidationError):
        SurveySubmission(**data)


def test_preferences_never_change_career_signals():
    first = submission(q13=5, q05=5, q17=4, q12=1, q16=1, q19=1)
    second = first.model_copy(deep=True)
    for i in range(21, 31):
        second.answers[f"q{i:02}"] = 5
    assert score_survey(first).careers == score_survey(second).careers
    assert score_survey(first).location != score_survey(second).location


def test_healthcare_signal_is_explained_and_repeatable():
    data = submission(q13=5, q05=5, q17=4, q12=1, q16=1, q19=1)
    result = score_survey(data)
    assert result == score_survey(data)
    assert result.has_direction
    assert result.careers[0].category == "Healthcare"
    positives = {q["text"] for q in CATALOG["questions"] if data.answers[q["id"]] >= 4}
    assert all(reason in positives for c in result.careers for reason in c.reasons)


def test_sparse_responses_and_unknowns_are_not_neutral():
    result = score_survey(submission(None, q13=5))
    assert not result.has_direction
    assert result.not_sure_count == 29
    assert all(c.score is None for c in result.careers)


def test_catalog_coverage():
    assert len(CATALOG["questions"]) == 30
    for section in CATALOG["sections"]:
        assert sum(q["section"] == section["id"] for q in CATALOG["questions"]) == 5
    for career in CATALOG["careers"]:
        assert sum(career["id"] in q["weights"] for q in CATALOG["questions"]) >= 3


def test_endpoint_and_no_store():
    with TestClient(app) as client:
        response = client.post("/api/v1/survey/results", json=submission().model_dump())
        assert response.status_code == 200
        assert response.headers["cache-control"] == "no-store"
        assert response.json()["has_direction"] is False
        assert client.post("/api/v1/survey/results", json={}).status_code == 422
