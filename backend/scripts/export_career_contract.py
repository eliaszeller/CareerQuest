"""Generate the frontend career response contract from Pydantic. Run with --check in CI."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from export_character_contract import ts_type  # noqa: E402

from app.schemas.career import (  # noqa: E402
    CareerExplanation,
    CareerExploreResponse,
    CareerSearchResponse,
    CareerSuggestions,
    OccupationDetail,
    PostingSearchResponse,
    SkillGapResponse,
    SkillNormalizeResponse,
)

MODELS = (
    CareerSearchResponse, CareerExploreResponse, OccupationDetail, SkillNormalizeResponse,
    CareerSuggestions, PostingSearchResponse, SkillGapResponse, CareerExplanation,
)


def contract() -> str:
    definitions: dict[str, dict] = {}
    for model in MODELS:
        schema = model.model_json_schema(mode="serialization")
        definitions.update(schema.pop("$defs", {}))
        definitions[model.__name__] = schema
    header = "// Generated from backend career schemas. Do not edit by hand.\n"
    return header + "\n".join(
        f"export type {name} = {ts_type(value)};\n" for name, value in sorted(definitions.items())
    )


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    target = Path(__file__).resolve().parents[2] / "frontend/src/features/careers/contract.ts"
    expected = contract()
    if args.check:
        if not target.exists() or target.read_text(encoding="utf-8") != expected:
            raise SystemExit("Career contract is stale. Run scripts/export_career_contract.py.")
        print("Career contract matches Pydantic.")
    else:
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(expected, encoding="utf-8")
        print("Career contract generated.")
