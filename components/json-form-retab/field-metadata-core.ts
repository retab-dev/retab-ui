/**
 * Field-level extraction metadata: the reasoning trace a model emitted for a
 * field, the consensus across a k-LLM run, and the confidence that falls out of
 * either signal. Pure data — the badges in `field-metadata.tsx` render it.
 */

/** One run of an extraction, as returned by a consensus (k-LLM) call. */
export interface ConsensusChoice {
  data: Record<string, unknown>;
  index: number;
  likelihoods?: Record<string, number>;
}

export interface ConsensusAlternative {
  value: unknown;
  index: number;
  reasoning: string | null;
}

export interface ConsensusContent {
  consolidated_value: unknown;
  alternatives: ConsensusAlternative[];
  count: number;
  agreement: number;
  hasVariation: boolean;
}

/** Where a field's confidence number came from. */
export type ConfidenceSource = "likelihood" | "agreement";

export interface FieldConfidence {
  /** 0–1. */
  value: number;
  source: ConfidenceSource;
  /** Runs that produced the consolidated value, when `source` is "agreement". */
  agreeing?: number;
  /** Total alternative runs, when `source` is "agreement". */
  count?: number;
}

export type ConfidenceTier = "high" | "medium" | "low";

export const CONFIDENCE_TIER_THRESHOLDS = { high: 0.9, medium: 0.7 } as const;

export function confidenceTier(value: number): ConfidenceTier {
  if (value >= CONFIDENCE_TIER_THRESHOLDS.high) return "high";
  if (value >= CONFIDENCE_TIER_THRESHOLDS.medium) return "medium";
  return "low";
}

function isRecordValue(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function isNormalizedConsensusChoice(
  value: Record<string, unknown>,
): value is Record<string, unknown> & {
  data: Record<string, unknown>;
  index: number;
} {
  return isRecordValue(value.data) && typeof value.index === "number";
}

/** `vendor.name` → `vendor.reasoning___name`, the sibling key models emit. */
export function getReasoningPath(path: string): string {
  const parts = path.split(".");
  const fieldName = parts.pop() || "";
  const parentPath = parts.join(".");

  return parentPath
    ? `${parentPath}.reasoning___${fieldName}`
    : `reasoning___${fieldName}`;
}

export function getValueByPath(obj: unknown, path: string): unknown {
  if (!path) return obj;
  return path.split(".").reduce((acc: unknown, segment: string) => {
    if (acc == null) return undefined;
    if (segment === "*") return acc;
    if (Array.isArray(acc) && /^\d+$/.test(segment)) {
      return acc[Number(segment)];
    }
    if (isRecordValue(acc)) {
      return acc[segment];
    }
    return undefined;
  }, obj);
}

/** `items.3.total` → `items.*.total`, the shape schema-keyed likelihoods use. */
function wildcardPath(path: string): string {
  return path
    .split(".")
    .map((segment) => (/^\d+$/.test(segment) ? "*" : segment))
    .join(".");
}

export function calculateConsensusContent(
  consensusDetails: ConsensusChoice[] | undefined,
  fieldPath: string,
): ConsensusContent | null {
  if (!consensusDetails || consensusDetails.length <= 1) {
    return null;
  }

  const consensusValue = getValueByPath(consensusDetails[0].data, fieldPath);
  const reasoningPath = getReasoningPath(fieldPath);
  const alternativeValues: ConsensusAlternative[] = consensusDetails
    .slice(1)
    .map((choice, index) => {
      const reasoning = getValueByPath(choice.data, reasoningPath);

      return {
        value: getValueByPath(choice.data, fieldPath),
        index: index + 2,
        reasoning: typeof reasoning === "string" ? reasoning : null,
      };
    })
    .filter((item) => item.value !== undefined);

  const stable = (value: unknown): string =>
    JSON.stringify(Array.isArray(value) ? value : (value ?? ""));
  const uniqueValues = [
    ...new Set(
      alternativeValues.map((alternative) => stable(alternative.value)),
    ),
  ];
  const agreementRatio =
    alternativeValues.length > 0
      ? alternativeValues.filter(
          (alternative) => stable(alternative.value) === stable(consensusValue),
        ).length / alternativeValues.length
      : 1;

  return {
    consolidated_value: consensusValue,
    alternatives: alternativeValues,
    count: alternativeValues.length,
    agreement: agreementRatio,
    hasVariation: uniqueValues.length > 1,
  };
}

/**
 * Resolve one confidence number for a field. An explicit per-field likelihood
 * wins — it is the model's own calibrated score — and consensus agreement is
 * the fallback when a k-LLM run is all we have.
 *
 * Likelihood maps arrive either flat (`{"items.0.total": 0.94}`, the streaming
 * `flat_likelihoods` shape), nested to mirror the data, or index-collapsed
 * (`items.*.total`); all three resolve.
 */
export function resolveFieldConfidence(
  likelihoods: Record<string, number> | undefined,
  consensus: ConsensusContent | null,
  fieldPath: string,
): FieldConfidence | null {
  const candidates = likelihoods
    ? [
        likelihoods[fieldPath],
        likelihoods[wildcardPath(fieldPath)],
        getValueByPath(likelihoods, fieldPath),
      ]
    : [];
  const likelihood = candidates.find(
    (candidate) => typeof candidate === "number" && Number.isFinite(candidate),
  ) as number | undefined;

  if (likelihood !== undefined) {
    return {
      value: Math.min(1, Math.max(0, likelihood)),
      source: "likelihood",
    };
  }

  if (!consensus || consensus.count === 0) {
    return null;
  }

  return {
    value: consensus.agreement,
    source: "agreement",
    agreeing: Math.round(consensus.agreement * consensus.count),
    count: consensus.count,
  };
}

function parseChoiceData(choice: Record<string, unknown>) {
  if (isRecordValue(choice.data)) {
    return choice.data;
  }

  const message = isRecordValue(choice.message) ? choice.message : null;
  if (isRecordValue(message?.parsed)) {
    return message.parsed;
  }

  if (typeof message?.content === "string") {
    try {
      const parsed = JSON.parse(message.content);
      return isRecordValue(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }

  return choice;
}

/**
 * Turn a raw API `choices` array into the `[consolidated, ...runs]` shape the
 * badges read, inserting the form's own data as the consolidated choice when
 * the payload does not already carry one.
 */
export function normalizeJsonFormConsensusDetails(
  mainData: Record<string, unknown>,
  rawDetails: Array<Record<string, unknown>> | undefined,
): ConsensusChoice[] {
  if (!Array.isArray(rawDetails) || rawDetails.length === 0) {
    return [];
  }

  const normalized = rawDetails.reduce<ConsensusChoice[]>(
    (choices, item, index) => {
      const isNormalizedChoice = isNormalizedConsensusChoice(item);
      const data = parseChoiceData(item);
      if (!data || Object.keys(data).length === 0) {
        return choices;
      }

      const likelihoods = isRecordValue(item.likelihoods)
        ? Object.fromEntries(
            Object.entries(item.likelihoods).filter(
              (entry): entry is [string, number] =>
                typeof entry[1] === "number",
            ),
          )
        : undefined;

      choices.push({
        data,
        index: isNormalizedChoice ? item.index : index + 1,
        likelihoods: likelihoods ?? {},
      });

      return choices;
    },
    [],
  );

  if (normalized.length === 0) {
    return [];
  }

  const hasConsolidatedChoice = rawDetails.some(
    (item) => isNormalizedConsensusChoice(item) && item.index === 0,
  );
  if (hasConsolidatedChoice) {
    return normalized;
  }

  return [{ data: mainData, index: 0, likelihoods: {} }, ...normalized];
}
