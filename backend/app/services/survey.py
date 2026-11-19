import json
from pathlib import Path

from app.schemas.survey import CareerSignal, Preference, SurveyResult, SurveySubmission

CATALOG = json.loads(
    (Path(__file__).resolve().parents[1] / "data/survey.v1.json").read_text(encoding="utf-8")
)


def score_survey(submission: SurveySubmission) -> SurveyResult:
    """Versioned exploration heuristic, not a validated psychological assessment."""
    answers = submission.answers
    careers = []
    for career in CATALOG["careers"]:
        relevant = [
            q
            for q in CATALOG["questions"]
            if career["id"] in q["weights"] and answers[q["id"]] is not None
        ]
        denominator = sum(q["weights"][career["id"]] for q in relevant)
        numerator = sum((answers[q["id"]] - 1) * q["weights"][career["id"]] for q in relevant)
        score = round(100 * numerator / (4 * denominator), 1) if len(relevant) >= 3 else None
        positive = sorted(
            [q for q in relevant if answers[q["id"]] >= 4],
            key=lambda q: (-q["weights"][career["id"]], q["id"]),
        )
        careers.append(
            CareerSignal(
                category=career["id"],
                score=score,
                answered_items=len(relevant),
                reasons=[q["text"] for q in positive[:3]],
            )
        )
    scored_count = sum(answers[f"q{i:02}"] is not None for i in range(1, 21))
    scores = [career.score for career in careers if career.score is not None]
    has_direction = (
        scored_count >= 12
        and len(scores) == 7
        and max(scores) >= 60
        and max(scores) - min(scores) >= 10
    )
    # Insufficient information or flat answers must not produce an arbitrary winner.
    if has_direction:
        careers.sort(key=lambda career: (-career.score, career.category))
    else:
        careers.sort(key=lambda career: career.category)

    def preferences(section):
        return [
            Preference(question_id=q["id"], text=q["text"], response=answers[q["id"]])
            for q in CATALOG["questions"]
            if q["section"] == section
        ]

    return SurveyResult(
        answered_count=sum(value is not None for value in answers.values()),
        not_sure_count=sum(value is None for value in answers.values()),
        has_direction=has_direction,
        careers=careers,
        learning=preferences("learning"),
        location=preferences("location"),
    )
