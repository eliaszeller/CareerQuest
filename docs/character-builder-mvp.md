# Character builder MVP

## Scope and experience

Both onboarding choices open the same four-step editor: starting point, story,
interests/skills, and review. A nickname and life stage are the only required
profile fields. Education, work/volunteering/caregiving, classes, projects,
interests, hobbies, skills, certifications, and a short exploration goal are optional.

Every entry can be added, edited, or removed. The latest removal can be undone.
Unsaved entry forms block navigation until saved or canceled. Imported entries
start as suggestions, with their original excerpts visible. Users must confirm,
edit-and-confirm, or remove suggestions before approval; a clearly labeled bulk
confirmation is available after review. Final approval also requires an explicit
checkbox. Changing the profile invalidates that acknowledgement.

The confirmed profile appears alongside the existing avatar selector, including
all eight entry categories. Users can return to edit or download JSON. The existing
quest views consume a read-only adapter; canonical application state remains the
shared CharacterProfile. Editing and reapproving resets the previous quest/path.

## Contract and API

- `CharacterProfile` schema version **2.0** lives in `backend/app/schemas/character.py`.
- Entries contain ID, category, title, details, source, review status, and optional excerpt.
- `POST /api/v1/characters/extract`: PDF/DOCX/TXT multipart upload; returns a profile
  draft and parser notices. It does not infer life stage or proficiency.
- `POST /api/v1/characters/approve`: validates the same profile; rejects incomplete
  basics, unreviewed suggestions, duplicate IDs, extra fields, and oversized fields.
- Responses are marked `Cache-Control: no-store`. Validation errors do not echo input.
- `backend/scripts/export_character_contract.py` generates `contract.ts`; `--check`
  detects frontend/backend type drift. Run the generator after changing the schema.
- The old `/resume/extract` route is deprecated and retained for compatibility.
  The new UI never calls it. The duplicate browser parser and dependencies were removed.

Limits: 80-character name, 500-character goal, 200 entries, 160-character entry titles,
2,000-character details, 500-character excerpts, 5 MB uploads, 40 PDF pages,
100,000 extracted characters, bounded DOCX archive expansion and item count.

## Privacy and lifetime

This is a local prototype. Run the API on loopback. Uploaded documents go to the
local backend, not a model service. Parsing uses temporary storage with cleanup
on success and failure. Documents and extracted full text are not saved to SQLite,
browser storage, source control, or application logs. Reviewed entries and short
source excerpts stay in memory while navigating. Refresh or close clears the profile;
the browser warns before leaving a populated draft. A download is an explicit user
action and contains personal information. Clear draft removes in-memory entries.

The API is stateless: approval validates and returns data, rather than persisting a
session. Authentication, durable storage, profile reimport, and shared-network hosting
are outside this milestone. Cancellation prevents stale responses updating the UI;
server-side parsing already in progress may finish before its temporary-file cleanup.

## Extraction behavior and limitations

Extraction is deterministic and conservative. It recognizes common headings,
inline lists, coursework, volunteering, hobbies, and interests. All explicit skills
are retained instead of selecting a degree-dependent top ten. Common contact lines
are omitted, but users must still review excerpts for information they do not want
to include. Experience and education may be grouped into editable text blocks to
avoid inventing employer/role relationships. Long blocks are split within limits.
Over-capacity imports show a warning; duplicate exact entries are not reimported.

Scanned PDFs need OCR elsewhere; the app offers manual entry instead. Complex
multi-column documents, unusual headings, and names can require corrections. No
extraction result is evidence of verified qualifications. No inference is made about
intelligence, suitability, proficiency, or hiring likelihood.

## Validation

- Backend tests cover both approval routes, every category, malformed schemas,
  suggestion gating, safe errors, TXT/PDF/DOCX extraction, archive limits,
  encryption, scanned PDFs, oversized content, and temporary-file cleanup.
- React tests cover editing, required basics, optional sections, undo, reset,
  reimport deduplication, cancellation, failure/retry, and existing quest continuity.
- Playwright runs the real frontend/API at desktop and phone sizes. It exercises
  manual completion, real upload/review, invalid files, API retry, keyboard use,
  profile export, and returning to edit. Axe checks WCAG A/AA rules in the builder.
- Test documents are synthetic. Browser screenshots/traces remain ignored artifacts.

O*NET integration, the adapted interest questionnaire, LinkedIn classification,
and trustworthy simulation/roadmap content are intentionally not part of this change.
