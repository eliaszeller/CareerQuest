import { useEffect, useState } from "react";
import { loadMarketCheck, skillsToBuild } from "./api";

/** Names of skills the target role asks for that the profile doesn't show, or [] if unknown. */
export function useSkillGaps(role: string, skills: string[]): string[] {
  const [gaps, setGaps] = useState<string[]>([]);
  const skillKey = skills.join("|");
  useEffect(() => {
    const controller = new AbortController();
    loadMarketCheck(role, skillKey ? skillKey.split("|") : [], controller.signal)
      .then((data) => { if (!controller.signal.aborted) setGaps(data ? skillsToBuild(data.gap, 5).map((item) => item.name) : []); })
      .catch(() => { if (!controller.signal.aborted) setGaps([]); });
    return () => controller.abort();
  }, [role, skillKey]);
  return gaps;
}
