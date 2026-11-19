# Future improvements

Open items after the MVP (O*NET, LinkedIn postings, résumé screener, explanations and the
fine-tuned embedder). They are roughly in priority order.

## Setup still to do on a dev machine

- **Rebuild the postings after the title-mapping fix.** From `backend`, run
  `python scripts/build_posting_index.py`, then `python scripts/build_finetune_pairs.py` if
  you want to retrain. The fix rejects fuzzy matches that add a qualifier the posting lacks
  ("associate" to "IT associate") or rest on generic words alone ("owner", "assistant").
- **Turn on AI-written explanations ("Why this could fit").** Without a text model, the
  Paths screen shows a standard summary built from the same facts. To get model-written
  points, run any server that accepts OpenAI-style `/v1/chat/completions` requests and set
  it in `.env`. For example, with Ollama (`ollama pull qwen3:8b`):

  ```
  TEXT_MODEL_URL=http://127.0.0.1:11434
  TEXT_MODEL_NAME=qwen3:8b
  ```

  This has not yet been tested against a real server. Check it with a request to
  `POST /api/v1/careers/explain` and look for `"generated_by": "model"`.

## Product

- **Replace the remaining placeholder numbers on the Paths screen.** The fit %, time and
  cost on each path card are still illustrative, and so are the skills and actions for the
  "Skills traverse" and "Bridge route" cards. Pay comes from postings when they are built.
  The next step is to derive fit from skill-gap coverage, and to fill the skills-traverse
  card from the real missing skills.
- **Review the survey-to-occupation mapping.** `backend/app/careers/families.py` maps the
  survey's 7 categories to SOC prefixes as a starter list. Have someone check that each
  category points to sensible occupations, especially for trades, healthcare and
  high-school users.
- **Use the fine-tuned embedder in more places.** Today it only ranks occupations for
  résumé suggestions. Role search on the Quest and Paths screens still uses title
  matching, and posting search still uses TF-IDF. Both could use the embedder.
- **Show the posting date range** (2023 to 2024) next to pay figures, so users know the
  data is a snapshot.
- **Share one skill-gap request.** The roadmap and the "Real-world check" panel each fetch
  the gap for the same role. Lifting it into shared state would save one request.

## Data and models

- **Measure title-mapping precision on a hand-labelled sample.** About 85% of postings
  map, but precision is only spot-checked. Known leftovers include "director of business
  development" mapping to Wind Energy Development Managers and "business intelligence
  developer" to a military occupation. Labelling 200 random mapped postings would give a
  real accuracy figure for the write-up.
- **Evaluate the embedder on independent labels.** Its Recall@5 of 0.82 (versus 0.49 for
  the base model and 0.44 for TF-IDF) is measured against our own title mapping. A small
  hand-labelled set of résumés or postings would show how well that holds up.
- **LoRA skill extractor (optional stretch).** `notebooks/lora_skill_extractor.ipynb` is
  ready to run (about 15 minutes on an A100). Its labels come from our O*NET dictionary
  matcher, so for a meaningful score, hand-check about 200 postings first. It is not wired
  into the app.
- **Confirm the Resume Dataset license.** It is used with credit for the class project
  only and is not redistributed. If the license forbids reuse, retrain the classifier on a
  permissively licensed résumé set.
- **Résumé classifier bias.** The 24 categories lean toward office and tech roles, so
  suggestions stay optional and the user must confirm them.

## Engineering

- **Run and extend the Playwright tests.** The new screens (Real-world check, Why this
  could fit, Sources, roadmap gaps) have unit tests but no browser test yet. Add one
  end-to-end scenario: résumé, then quest, then paths with the market panel, then roadmap.
- **CI.** `.github/workflows/ci.yml` runs the backend and frontend unit tests. Tests that
  need scikit-learn are skipped unless the `career` extra is installed, which CI does.
- **First-run time with the embedder.** The first résumé upload after training a new
  model takes about a minute on a laptop CPU while occupation vectors are cached in
  `backend/models/embedder/occupation_vectors.npz`. Later uploads are fast.
- **Licensing of derived files.** Anything built from the LinkedIn postings (careers.db
  market tables, the posting index, the fine-tuning pairs, the embedder) is CC BY-SA 4.0
  and stays out of git (see `.gitignore`). Share it only with that license and credit.
