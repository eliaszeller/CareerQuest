import type { CareerExplanation, CareerSearchResponse, OccupationDetail, SkillGapResponse } from "./contract";

export class CareerDataUnavailable extends Error {}

async function call<T>(path: string, init: RequestInit = {}, signal?: AbortSignal): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api/v1/careers/${path}`, { ...init, signal, cache: "no-store" });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new CareerDataUnavailable("We couldn’t reach the local API.");
  }
  if (response.status === 503) throw new CareerDataUnavailable("Career data is not built yet.");
  if (!response.ok) throw new Error("Career data could not be loaded.");
  return response.json() as Promise<T>;
}

export type MarketCheck = { detail: OccupationDetail; gap: SkillGapResponse } | null;

/** Find the closest O*NET occupation for a role, then load its details and skill gap. */
export async function loadMarketCheck(role: string, skills: string[], signal?: AbortSignal): Promise<MarketCheck> {
  const search = await call<CareerSearchResponse>(`search?q=${encodeURIComponent(role)}&limit=1`, {}, signal);
  const match = search.results[0];
  if (!match) return null;
  const [detail, gap] = await Promise.all([
    call<OccupationDetail>(encodeURIComponent(match.soc), {}, signal),
    call<SkillGapResponse>("gap", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ soc: match.soc, skills }) }, signal),
  ]);
  return { detail, gap };
}

/** Plain-language explanation of a match. Every point cites facts the server retrieved. */
export function loadExplanation(soc: string, skills: string[], goal: string | undefined, signal?: AbortSignal): Promise<CareerExplanation> {
  return call<CareerExplanation>("explain", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ soc, skills, goal: goal || null }) }, signal);
}

/** Skills an occupation asks for that the profile doesn't show yet, most important first. */
export function skillsToBuild(gap: SkillGapResponse, limit = 8) {
  return gap.items.filter((item) => !item.have && item.kind !== "transferable").slice(0, limit);
}

export function formatSalary(value: number): string {
  return `$${Math.round(value / 1000)}K`;
}
