from pathlib import Path as FilePath

from fastapi import APIRouter, Depends, HTTPException, Path, Query

from app.core.config import Settings, get_settings
from app.repositories.careers import CareerDataUnavailable, CareerRepository
from app.schemas.career import (
    SOC_PATTERN,
    CareerExplanation,
    CareerExploreResponse,
    CareerSearchResponse,
    ExplainRequest,
    OccupationDetail,
    PostingSearchRequest,
    PostingSearchResponse,
    SkillGapRequest,
    SkillGapResponse,
    SkillMatch,
    SkillNormalizeRequest,
    SkillNormalizeResponse,
)
from app.schemas.survey import CareerCategory
from app.services.career_explain import explain_career
from app.services.posting_search import search_postings
from app.services.skill_gap import skill_gap
from app.services.skills import known_skill_terms, normalize_label

router = APIRouter(prefix="/careers", tags=["careers"])


def get_repository(settings: Settings = Depends(get_settings)) -> CareerRepository:
    try:
        return CareerRepository(FilePath(settings.career_db_path))
    except CareerDataUnavailable as exc:
        raise HTTPException(
            503,
            detail="Career data is not built yet. Run scripts/build_career_db.py in backend.",
        ) from exc


@router.get("/search", response_model=CareerSearchResponse)
def search(
    q: str = Query(min_length=2, max_length=80),
    limit: int = Query(default=10, ge=1, le=50),
    repo: CareerRepository = Depends(get_repository),
) -> CareerSearchResponse:
    return CareerSearchResponse(query=q, results=repo.search(q, limit), source=repo.source())


@router.get("/explore/{category}", response_model=CareerExploreResponse)
def explore(
    category: CareerCategory,
    limit: int = Query(default=25, ge=1, le=100),
    repo: CareerRepository = Depends(get_repository),
) -> CareerExploreResponse:
    return CareerExploreResponse(
        category=category, results=repo.explore(category, limit), source=repo.source()
    )


@router.post("/skills/normalize", response_model=SkillNormalizeResponse)
def normalize_skills(
    request: SkillNormalizeRequest, repo: CareerRepository = Depends(get_repository)
) -> SkillNormalizeResponse:
    terms = known_skill_terms()
    matches = []
    for label in request.skills:
        name, kind = normalize_label(label, terms)
        matches.append(SkillMatch(label=label, onet_name=name, match=kind))
    return SkillNormalizeResponse(matches=matches, source=repo.source())


@router.post("/postings/search", response_model=PostingSearchResponse)
def postings_search(
    request: PostingSearchRequest, repo: CareerRepository = Depends(get_repository)
) -> PostingSearchResponse:
    source = repo.postings_source()
    if source is None:
        raise HTTPException(
            503, detail="Job postings are not built yet. Run scripts/build_posting_index.py."
        )
    results, method = search_postings(repo, request.query, request.soc, request.limit)
    return PostingSearchResponse(results=results, method=method, source=source)


@router.post("/gap", response_model=SkillGapResponse)
def gap(
    request: SkillGapRequest, repo: CareerRepository = Depends(get_repository)
) -> SkillGapResponse:
    detail = repo.occupation(request.soc)
    if detail is None:
        raise HTTPException(404, detail="No O*NET occupation has that code.")
    return skill_gap(repo, detail, request.skills)


@router.post("/explain", response_model=CareerExplanation)
def explain(
    request: ExplainRequest,
    repo: CareerRepository = Depends(get_repository),
    settings: Settings = Depends(get_settings),
) -> CareerExplanation:
    detail = repo.occupation(request.soc)
    if detail is None:
        raise HTTPException(404, detail="No O*NET occupation has that code.")
    return explain_career(settings, repo, detail, request.skills, request.goal)


@router.get("/{soc}", response_model=OccupationDetail)
def occupation(
    soc: str = Path(pattern=SOC_PATTERN),
    repo: CareerRepository = Depends(get_repository),
) -> OccupationDetail:
    detail = repo.occupation(soc)
    if detail is None:
        raise HTTPException(404, detail="No O*NET occupation has that code.")
    return detail
