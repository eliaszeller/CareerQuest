import sys
from pathlib import Path

from export_character_contract import ts_type

from app.schemas.survey import SurveyResult

root = Path(__file__).resolve().parents[2]
schema = SurveyResult.model_json_schema(mode="serialization")
defs = schema.pop("$defs", {})
defs["SurveyResult"] = schema
files = {
    root / "frontend/src/features/survey/contract.ts": "// Generated from Pydantic. Do not edit.\n"
    + "\n".join(f"export type {k} = {ts_type(v)};\n" for k, v in defs.items()),
    root / "frontend/src/features/survey/catalog.json": (
        root / "backend/app/data/survey.v1.json"
    ).read_text(encoding="utf-8"),
}
for path, content in files.items():
    if "--check" in sys.argv:
        if not path.exists() or path.read_text(encoding="utf-8") != content:
            raise SystemExit(f"Stale survey contract: {path.name}")
    else:
        path.write_text(content, encoding="utf-8")
