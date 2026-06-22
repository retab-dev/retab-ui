// Classification result shape for the classifier viewer.

export interface ClassifyResult {
  category: string;
  reasoning?: string;
  candidates?: readonly ClassifyCandidate[];
}

export interface ClassifyCandidate {
  category: string;
  description?: string;
}
