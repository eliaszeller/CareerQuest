// Generated from Pydantic. Do not edit.
export type CareerSignal = {
  category: "Healthcare" | "Business" | "Education" | "Military" | "Law" | "Trades" | "Political";
  score: number | null;
  answered_items: number;
  reasons: Array<string>;
};

export type Preference = {
  question_id: string;
  text: string;
  response: number | null;
};

export type SurveyResult = {
  version: "careerquest-survey-1.0";
  answered_count: number;
  not_sure_count: number;
  has_direction: boolean;
  careers: Array<CareerSignal>;
  learning: Array<Preference>;
  location: Array<Preference>;
};
