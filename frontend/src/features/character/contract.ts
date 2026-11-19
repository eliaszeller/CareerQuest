// Generated from backend CharacterProfile. Do not edit by hand.
export type CharacterEntry = {
  id: string;
  category: "education" | "experience" | "skills" | "interests" | "classes" | "hobbies" | "projects" | "certifications";
  title: string;
  details: string;
  source: "manual" | "resume";
  status: "suggested" | "confirmed";
  evidence: string | null;
};

export type LifeStage = "high_school" | "college" | "graduate_or_professional" | "workforce";

export type CharacterProfile = {
  schema_version: "2.0";
  id: string;
  name: string;
  life_stage: LifeStage | null;
  goal: string;
  entries: Array<CharacterEntry>;
  approval_status: "draft" | "approved";
};
