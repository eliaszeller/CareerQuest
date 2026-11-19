import type { CharacterEntry, CharacterProfile, LifeStage } from "./contract";
export type { CharacterEntry, CharacterProfile, LifeStage } from "./contract";
export type Category = CharacterEntry["category"];
export const categories = ["education", "experience", "skills", "interests", "classes", "hobbies", "projects", "certifications"] as const satisfies readonly Category[];
export const stages = {
  high_school: "High school", college: "College",
  graduate_or_professional: "Graduate or professional school", workforce: "Workforce",
} as const satisfies Record<LifeStage, string>;

export const categoryInfo: Record<Category, { label: string; singular: string; hint: string; placeholder: string; icon: string }> = {
  education: { label: "Education", singular: "Education", hint: "School, training, or learning on your own all count.", placeholder: "e.g. Central High School", icon: "01" },
  experience: { label: "Experience", singular: "Experience", hint: "Paid work, volunteering, clubs, and family responsibilities.", placeholder: "e.g. Volunteer at the community garden", icon: "02" },
  classes: { label: "Classes", singular: "Class", hint: "A class you enjoyed, an online course, or a workshop.", placeholder: "e.g. AP Biology or Intro to Design", icon: "03" },
  projects: { label: "Projects", singular: "Project", hint: "Something you made, organized, researched, or tried.", placeholder: "e.g. Built a website for our school club", icon: "04" },
  skills: { label: "Skills", singular: "Skill", hint: "Things you have practiced. You don’t need to be an expert.", placeholder: "e.g. Public speaking or Python", icon: "05" },
  interests: { label: "Interests", singular: "Interest", hint: "Topics and problems you would like to explore.", placeholder: "e.g. Helping people or renewable energy", icon: "06" },
  hobbies: { label: "Hobbies", singular: "Hobby", hint: "What you choose to do in your own time.", placeholder: "e.g. Drawing, gaming, or repairing bikes", icon: "07" },
  certifications: { label: "Certifications", singular: "Certification", hint: "Optional: certificates, licenses, or completed training.", placeholder: "e.g. First Aid certificate", icon: "08" },
};

export function emptyProfile(): CharacterProfile {
  return { schema_version: "2.0", id: crypto.randomUUID(), name: "", life_stage: null,
    goal: "", entries: [], approval_status: "draft" };
}

export function mergeResume(current: CharacterProfile, imported: CharacterProfile) {
  const key = (entry: CharacterEntry) => `${entry.category}:${entry.title.trim().toLowerCase()}:${entry.details.trim().toLowerCase()}`;
  const seen = new Set(current.entries.map(key));
  const unique = imported.entries.filter((entry) => {
    if (seen.has(key(entry))) return false;
    seen.add(key(entry)); return true;
  });
  const added = Math.min(unique.length, 200 - current.entries.length);
  return {
    profile: { ...current, name: current.name.trim() ? current.name : imported.name,
      entries: [...current.entries, ...unique.slice(0, added)], approval_status: "draft" as const },
    added, omitted: unique.length - added,
  };
}

export function approvalIssues(profile: CharacterProfile): string[] {
  return [
    ...(!profile.name.trim() ? ["Add a character name."] : []),
    ...(!profile.life_stage ? ["Choose your life stage."] : []),
    ...(profile.entries.some((entry) => entry.status === "suggested") ? ["Confirm or remove the remaining résumé suggestions."] : []),
  ];
}

export function isCharacterProfile(value: unknown): value is CharacterProfile {
  if (!value || typeof value !== "object") return false;
  const p = value as CharacterProfile;
  return p.schema_version === "2.0" && typeof p.id === "string" && typeof p.name === "string"
    && p.name.length <= 80 && (p.life_stage === null || Object.hasOwn(stages, p.life_stage))
    && typeof p.goal === "string" && p.goal.length <= 500
    && ["draft", "approved"].includes(p.approval_status)
    && Array.isArray(p.entries) && p.entries.length <= 200
    && new Set(p.entries.map((entry) => entry?.id)).size === p.entries.length
    && p.entries.every((entry) => entry && typeof entry.id === "string"
      && categories.includes(entry.category) && typeof entry.title === "string"
      && entry.title.trim().length > 0 && entry.title.length <= 160
      && typeof entry.details === "string" && entry.details.length <= 2000
      && ["manual", "resume"].includes(entry.source) && ["suggested", "confirmed"].includes(entry.status)
      && (entry.evidence === null || (typeof entry.evidence === "string" && entry.evidence.length <= 500)));
}

// Transitional read-only adapter for the existing quest screens. The canonical state
// remains CharacterProfile; no separate résumé-only profile is stored.
export function toJourneyProfile(profile: CharacterProfile) {
  const values = (category: Category) => profile.entries
    .filter((entry) => entry.category === category && entry.status === "confirmed")
    .map((entry) => [entry.title, entry.details].filter(Boolean).join("\n"));
  return { filename: "Confirmed character", character_count: 0, message: "Your character is ready.",
    draft: { name: profile.name, education: values("education"), experience: values("experience"),
      skills: values("skills"), certifications: values("certifications"), projects: values("projects") } };
}
