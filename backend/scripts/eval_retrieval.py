"""Report Recall@1/5/10 and MRR for occupation retrieval on the held-out postings.

    python scripts/eval_retrieval.py                       # TF-IDF baseline
    python scripts/eval_retrieval.py --model BAAI/bge-small-en-v1.5
    python scripts/eval_retrieval.py --model models/embedder   # your fine-tuned model

Embedding models need: pip install sentence-transformers
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.finetune.evaluate import evaluate  # noqa: E402

DATA = Path(__file__).resolve().parents[2] / "data" / "processed" / "finetune"

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--data", type=Path, default=DATA)
    parser.add_argument("--model", default=None, help="sentence-transformers name or folder")
    args = parser.parse_args()
    if not (args.data / "eval.jsonl").is_file():
        raise SystemExit("Run scripts/build_finetune_pairs.py first.")
    print(json.dumps(evaluate(args.data, args.model), indent=2))
