export type CardTheme =
  | "commerce"
  | "issuing"
  | "money"
  | "payments"
  | "document_workflows_scale"
  | "human_in_loop"
  | "billing"
  | "embedded"
  | "confidence"
  | "composer_agent"
  | "document_workflows"
  | "studio_evals"
  | "k_llms_consensus";

export type CardRow = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
export type CardTone = "default" | "warm";

export type CardItem = {
  id: string;
  title: string;
  subtitle?: string;
  theme: CardTheme;
  row: CardRow;
  isWide?: boolean;
};
