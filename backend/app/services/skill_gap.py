"""Compare a user's confirmed skills with what an occupation requires and employers ask for."""

from __future__ import annotations

from app.repositories.careers import CareerRepository
from app.schemas.career import GapItem, OccupationDetail, SkillGapResponse
from app.services.skills import known_skill_terms, normalize_label

NOTE = (
    "Required and transferable skills come from O*NET ratings; preferred skills are software "
    "named in job postings for this occupation. A match means the name appears in your "
    "profile, not that your level has been assessed."
)


def _have(name: str, labels: list[str], canonical: dict[str, str]) -> str | None:
    key = name.casefold()
    for label in labels:
        low = label.casefold()
        # Substring matches only for longer names, so "R" never matches "Project".
        if low == key or (len(key) > 3 and key in low) or (len(low) > 3 and low in key):
            return label
    return canonical.get(key)


def skill_gap(repo: CareerRepository, detail: OccupationDetail, skills: list[str]
              ) -> SkillGapResponse:
    terms = known_skill_terms()
    canonical: dict[str, str] = {}
    for label in skills:
        name, _ = normalize_label(label, terms)
        if name:
            canonical.setdefault(name.casefold(), label)

    items: list[GapItem] = []

    def add(name: str, kind: str, detail_text: str | None = None) -> None:
        matched = _have(name, skills, canonical)
        items.append(GapItem(name=name, kind=kind, have=matched is not None,
                             matched_by=matched, detail=detail_text))

    for rating in detail.essential_skills:
        if rating.required:
            add(rating.name, "required", f"O*NET importance {rating.importance:.1f} of 5")
    for rating in detail.transferable_skills[:8]:
        add(rating.name, "transferable", f"O*NET importance {rating.importance:.1f} of 5"
            if rating.importance is not None else None)
    for software in detail.software[:10]:
        add(software.name, "software", "in demand" if software.in_demand else
            ("hot technology" if software.hot_technology else None))
    seen = {item.name for item in items}
    if detail.market:
        for preferred in detail.market.preferred_skills:
            if preferred.name not in seen:
                add(preferred.name, "preferred", f"in {round(preferred.share * 100)}% of postings")

    scored = [item for item in items if item.kind in ("required", "software", "preferred")]
    coverage = round(sum(item.have for item in scored) / len(scored), 3) if scored else None
    sources = [detail.source] + ([detail.market.source] if detail.market else [])
    return SkillGapResponse(soc=detail.soc, title=detail.title, coverage=coverage,
                            items=items, note=NOTE, sources=sources)
