// Generated from backend career schemas. Do not edit by hand.
export type CareerExplanation = {
  soc: string;
  title: string;
  summary: string;
  points: Array<ExplanationPoint>;
  facts: Array<ExplanationFact>;
  generated_by: "model" | "template";
  model: string | null;
  note: string;
  sources: Array<DataSource>;
};

export type CareerExploreResponse = {
  category: "Healthcare" | "Business" | "Education" | "Military" | "Law" | "Trades" | "Political";
  results: Array<OccupationSummary>;
  source: DataSource;
};

export type CareerSearchResponse = {
  query: string;
  results: Array<OccupationSummary>;
  source: DataSource;
};

export type CareerSuggestions = {
  categories: Array<CategoryGuess>;
  occupations: Array<OccupationSuggestion>;
  note: string;
  source: DataSource | null;
};

export type CategoryGuess = {
  category: string;
  label: string;
  confidence: number;
  model_version: string;
};

export type DataSource = {
  name: string;
  version: string;
  license: string;
  license_url: string;
  attribution: string;
};

export type ExplanationFact = {
  id: string;
  text: string;
  source: string;
};

export type ExplanationPoint = {
  text: string;
  facts: Array<string>;
};

export type GapItem = {
  name: string;
  kind: "required" | "transferable" | "software" | "preferred";
  have: boolean;
  matched_by: string | null;
  detail: string | null;
};

export type JobZone = {
  zone: number;
  name: string | null;
  education: string | null;
  experience: string | null;
  training: string | null;
};

export type MarketSummary = {
  postings: number;
  salary: SalaryRange | null;
  preferred_skills: Array<PreferredSkill>;
  sample_postings: Array<PostingSummary>;
  source: DataSource;
};

export type OccupationDetail = {
  soc: string;
  title: string;
  description: string;
  alternate_titles: Array<string>;
  job_zone: JobZone | null;
  essential_skills: Array<SkillRating>;
  transferable_skills: Array<SkillRating>;
  knowledge: Array<SkillRating>;
  software: Array<SoftwareSkill>;
  related: Array<RelatedOccupation>;
  source: DataSource;
  market: MarketSummary | null;
};

export type OccupationSuggestion = {
  soc: string;
  title: string;
  score: number | null;
  reason: "similar_wording" | "resume_category";
};

export type OccupationSummary = {
  soc: string;
  title: string;
  job_zone: number | null;
  matched_title: string;
};

export type PostingSearchResponse = {
  results: Array<PostingSummary>;
  method: "tfidf_index" | "title_match";
  source: DataSource;
};

export type PostingSummary = {
  job_id: string;
  soc: string;
  title: string;
  company: string | null;
  location: string | null;
  experience_level: string | null;
  work_type: string | null;
  salary_annual: number | null;
  listed_date: string | null;
  url: string | null;
  snippet: string;
  score: number | null;
};

export type PreferredSkill = {
  name: string;
  share: number;
  in_onet: boolean;
};

export type RelatedOccupation = {
  soc: string;
  title: string;
  tier: string;
};

export type SalaryRange = {
  postings_with_salary: number;
  p25: number;
  median: number;
  p75: number;
};

export type SkillGapResponse = {
  soc: string;
  title: string;
  coverage: number | null;
  items: Array<GapItem>;
  note: string;
  sources: Array<DataSource>;
};

export type SkillMatch = {
  label: string;
  onet_name: string | null;
  match: "exact" | "alias" | "none";
};

export type SkillNormalizeResponse = {
  matches: Array<SkillMatch>;
  source: DataSource;
};

export type SkillRating = {
  element_id: string;
  name: string;
  importance: number | null;
  level: number | null;
  required: boolean;
};

export type SoftwareSkill = {
  name: string;
  category: string;
  hot_technology: boolean;
  in_demand: boolean;
};
