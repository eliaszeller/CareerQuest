import pytest
from pydantic import ValidationError

from app.schemas.character import StandardizedTestScore


def test_valid_sat_score() -> None:
    score = StandardizedTestScore(
        exam="SAT",
        composite_or_total=1280,
        sections={"reading_and_writing": 640, "math": 640},
        provenance="user_entered",
        verified_by_user=True,
    )
    assert score.composite_or_total == 1280


@pytest.mark.parametrize("exam,total", [("ACT", 37), ("SAT", 399)])
def test_invalid_test_total_is_rejected(exam: str, total: int) -> None:
    with pytest.raises(ValidationError):
        StandardizedTestScore(
            exam=exam,
            composite_or_total=total,
            provenance="user_entered",
        )

