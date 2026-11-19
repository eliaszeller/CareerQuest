"""Generate the frontend response contract from Pydantic. Run with --check in CI."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from app.schemas.character import CharacterProfile


def ts_type(schema: dict) -> str:
    if "$ref" in schema:
        return schema["$ref"].rsplit("/", 1)[1]
    if "const" in schema:
        return json.dumps(schema["const"])
    if "enum" in schema:
        return " | ".join(json.dumps(value) for value in schema["enum"])
    if "anyOf" in schema:
        return " | ".join(ts_type(value) for value in schema["anyOf"])
    kind = schema.get("type")
    if kind == "array":
        return f"Array<{ts_type(schema['items'])}>"
    if kind == "object":
        # API responses serialize defaults, so every response property is present.
        fields = [f"  {key}: {ts_type(value)};" for key, value in schema["properties"].items()]
        return "{\n" + "\n".join(fields) + "\n}"
    if kind in ("string", "boolean", "null"):
        return kind
    if kind in ("integer", "number"):
        return "number"
    raise ValueError(f"Unsupported schema form: {schema}")


def contract() -> str:
    schema = CharacterProfile.model_json_schema(mode="serialization")
    definitions = schema.pop("$defs", {})
    definitions["CharacterProfile"] = schema
    header = "// Generated from backend CharacterProfile. Do not edit by hand.\n"
    return header + "\n".join(
        f"export type {name} = {ts_type(value)};\n" for name, value in definitions.items()
    )


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    target = Path(__file__).resolve().parents[2] / "frontend/src/features/character/contract.ts"
    expected = contract()
    if args.check:
        if not target.exists() or target.read_text(encoding="utf-8") != expected:
            raise SystemExit(
                "Character contract is stale. Run scripts/export_character_contract.py."
            )
        print("Character contract matches Pydantic.")
    else:
        target.write_text(expected, encoding="utf-8")
        print("Character contract generated.")
