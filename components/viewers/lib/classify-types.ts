// Classification result shape for the classifier viewer.

export interface ClassifyResult {
  category: string;
  reasoning?: string;
  candidates?: readonly ClassifyCandidate[];
  consensus?: ClassifyConsensus | null;
}

export interface ClassifyCandidate {
  category: string;
  description?: string;
}

export interface ClassifyConsensus {
  choices?: readonly ClassifyConsensusChoice[];
  /** Consensus likelihood score (0.0-1.0) of the winning classification. */
  likelihoods?: number | null;
}

export interface ClassifyConsensusChoice {
  category: string;
  reasoning?: string;
}
