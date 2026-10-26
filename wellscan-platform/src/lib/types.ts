export type ProfileId = "general" | "pregnant" | "diabetes" | "child" | "nutrition" | "allergy";

export type IngredientFinding = {
  original_name: string;
  normalized_name: string;
  category: string;
  level: "info" | "caution" | "high_caution" | "unknown";
  reason: string;
  evidence_note: string;
  profile_relevance: string;
};

export type AnalysisResult = {
  detected_language: string;
  translated_ingredients: string;
  product_name: string | null;
  ingredients: IngredientFinding[];
  overall_summary: string;
  uncertainty_notes: string[];
  needs_user_review: boolean;
  disclaimer: string;
};
