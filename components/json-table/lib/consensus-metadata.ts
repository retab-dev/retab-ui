import type { TableDocument } from "@/components/json-table/lib/projects-types";

type PredictionMetadata = TableDocument["prediction_data"]["metadata"];
type PresentPredictionMetadata = NonNullable<PredictionMetadata>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

export function getPredictionLikelihoods(
  metadata: PredictionMetadata | undefined,
): Record<string, unknown> {
  const canonicalLikelihoods = metadata?.consensus?.likelihoods;
  if (isRecord(canonicalLikelihoods)) {
    return canonicalLikelihoods;
  }

  const legacyLikelihoods = metadata?.likelihoods;
  if (isRecord(legacyLikelihoods)) {
    return legacyLikelihoods;
  }

  return {};
}

export function getPredictionConsensusDetails(
  metadata: PredictionMetadata | undefined,
): Array<Record<string, unknown>> {
  const canonicalChoices = metadata?.consensus?.choices;
  if (Array.isArray(canonicalChoices)) {
    return canonicalChoices
      .filter(isRecord)
      .map((choice) => ({ data: choice }));
  }

  const legacyDetails = metadata?.consensus_details;
  if (Array.isArray(legacyDetails)) {
    return legacyDetails.filter(isRecord);
  }

  return [];
}

export function buildPredictionMetadata({
  extractionId,
  consensusChoices,
  likelihoods,
}: {
  extractionId?: string | null;
  consensusChoices?: Array<Record<string, unknown>>;
  likelihoods?: Record<string, unknown>;
}): PresentPredictionMetadata {
  const metadata: Record<string, unknown> = {};

  if (typeof extractionId === "string" || extractionId === null) {
    metadata.extraction_id = extractionId;
  }

  const normalizedChoices = Array.isArray(consensusChoices)
    ? consensusChoices.filter(isRecord)
    : [];
  const normalizedLikelihoods = isRecord(likelihoods) ? likelihoods : undefined;

  if (normalizedChoices.length > 0 || normalizedLikelihoods) {
    metadata.consensus = {
      choices: normalizedChoices,
      ...(normalizedLikelihoods ? { likelihoods: normalizedLikelihoods } : {}),
    };
  }

  return metadata as PresentPredictionMetadata;
}
