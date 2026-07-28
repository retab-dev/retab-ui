import type { ConsensusChoice } from "@/components/json-form-retab/field-metadata-core";
import sampleData from "@/components/json-form-retab/sample/data.json";

/**
 * Four runs of the same mortgage extraction, expressed as what each run saw
 * differently from the consolidated answer. Every disagreement here is one a
 * real k-LLM run produces: a shortened party name, a marketing name mistaken
 * for a recorded condominium regime, a misread rate digit, an over-eager
 * second document reference.
 */
const RUN_DELTAS: ReadonlyArray<Record<string, unknown>> = [
  {},
  {
    CondominiumName: "Bayfront Tower Condominium",
    reasoning___CondominiumName:
      'Took the name from the letterhead — "Bayfront Tower" — and appended "Condominium" to match the Declaration\'s caption.',
    DocumentReferences: [
      sampleData.DocumentReferences[0],
      {
        InstrumentNumber: null,
        RecordingDate: "1998-04-02",
        Book: "18042",
        Page: "1129",
        reasoning___Book:
          "Read the plat citation in Exhibit A as a second recorded instrument.",
      },
    ],
  },
  {
    BeneficiaryName: "Sunstate Federal Savings",
    reasoning___BeneficiaryName:
      'Used the signature block on page 7, which omits "Bank".',
    CondominiumName: "Bayfront Tower",
    reasoning___CondominiumName:
      "Letterhead names the building; treated it as the condominium name.",
    InterestRatePercent: 4.325,
    reasoning___InterestRatePercent:
      "Read the figure in Section 2 as 4.325%; the written words were not cross-checked.",
  },
  {
    CondominiumName: "Bayfront Tower, a Condominium",
    reasoning___CondominiumName:
      "Reconstructed the regime name from the Declaration reference in Exhibit A.",
    Borrower: { TaxId: "592-88-4471" },
  },
];

function mergeRun(
  base: Record<string, unknown>,
  delta: Record<string, unknown>,
): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(delta)) {
    const current = merged[key];
    merged[key] =
      value && typeof value === "object" && !Array.isArray(value)
        ? mergeRun(
            (current ?? {}) as Record<string, unknown>,
            value as Record<string, unknown>,
          )
        : value;
  }
  return merged;
}

/** `[consolidated, ...runs]` — the shape `JsonFormRetab` reads. */
export const sampleConsensusDetails: ConsensusChoice[] = [
  { data: sampleData as Record<string, unknown>, index: 0 },
  ...RUN_DELTAS.map((delta, index) => ({
    data: mergeRun(sampleData as Record<string, unknown>, delta),
    index: index + 1,
  })),
];
