import { describe, expect, it } from "vitest";

import {
  calculateConsensusContent,
  confidenceTier,
  getReasoningPath,
  normalizeJsonFormConsensusDetails,
  resolveFieldConfidence,
  type ConsensusChoice,
} from "@/components/json-form-retab/field-metadata-core";

const runs: ConsensusChoice[] = [
  { data: { vendor: { name: "Acme" }, total: 100 }, index: 0 },
  { data: { vendor: { name: "Acme" }, total: 100 }, index: 1 },
  { data: { vendor: { name: "Acme" }, total: 100 }, index: 2 },
  { data: { vendor: { name: "Acme Inc." }, total: 100 }, index: 3 },
  { data: { vendor: { name: "Acme" }, total: 105 }, index: 4 },
];

describe("reasoning paths", () => {
  it("addresses the sibling reasoning key at any depth", () => {
    expect(getReasoningPath("total")).toBe("reasoning___total");
    expect(getReasoningPath("vendor.name")).toBe("vendor.reasoning___name");
    expect(getReasoningPath("items.2.price")).toBe("items.2.reasoning___price");
  });
});

describe("consensus content", () => {
  it("scores agreement against the consolidated choice", () => {
    const consensus = calculateConsensusContent(runs, "vendor.name");

    expect(consensus).not.toBeNull();
    expect(consensus?.consolidated_value).toBe("Acme");
    expect(consensus?.count).toBe(4);
    expect(consensus?.agreement).toBe(0.75);
    expect(consensus?.hasVariation).toBe(true);
    expect(consensus?.alternatives.map((a) => a.index)).toEqual([2, 3, 4, 5]);
  });

  it("reports full agreement without variation", () => {
    const consensus = calculateConsensusContent(runs, "total");

    expect(consensus?.agreement).toBe(0.75);
    expect(
      calculateConsensusContent(runs.slice(0, 3), "total")?.agreement,
    ).toBe(1);
    expect(
      calculateConsensusContent(runs.slice(0, 3), "total")?.hasVariation,
    ).toBe(false);
  });

  it("needs more than one choice to mean anything", () => {
    expect(calculateConsensusContent(undefined, "total")).toBeNull();
    expect(calculateConsensusContent(runs.slice(0, 1), "total")).toBeNull();
  });

  it("collects per-model reasoning from the alternatives", () => {
    const withReasoning: ConsensusChoice[] = [
      { data: { total: 100 }, index: 0 },
      {
        data: { total: 100, reasoning___total: "Sum of line items." },
        index: 1,
      },
      { data: { total: 105 }, index: 2 },
    ];

    expect(
      calculateConsensusContent(withReasoning, "total")?.alternatives,
    ).toEqual([
      { value: 100, index: 2, reasoning: "Sum of line items." },
      { value: 105, index: 3, reasoning: null },
    ]);
  });
});

describe("confidence", () => {
  const consensus = calculateConsensusContent(runs, "vendor.name");

  it("prefers an explicit likelihood over consensus agreement", () => {
    expect(
      resolveFieldConfidence({ "vendor.name": 0.42 }, consensus, "vendor.name"),
    ).toEqual({ value: 0.42, source: "likelihood" });
  });

  it("resolves flat, index-collapsed, and nested likelihood maps", () => {
    expect(
      resolveFieldConfidence({ "items.0.total": 0.9 }, null, "items.0.total"),
    ).toEqual({ value: 0.9, source: "likelihood" });
    expect(
      resolveFieldConfidence({ "items.*.total": 0.8 }, null, "items.0.total"),
    ).toEqual({ value: 0.8, source: "likelihood" });
    expect(
      resolveFieldConfidence(
        { vendor: { name: 0.7 } } as unknown as Record<string, number>,
        null,
        "vendor.name",
      ),
    ).toEqual({ value: 0.7, source: "likelihood" });
  });

  it("falls back to agreement, counting the runs behind it", () => {
    expect(resolveFieldConfidence(undefined, consensus, "vendor.name")).toEqual(
      {
        value: 0.75,
        source: "agreement",
        agreeing: 3,
        count: 4,
      },
    );
  });

  it("has nothing to show without either signal", () => {
    expect(resolveFieldConfidence(undefined, null, "vendor.name")).toBeNull();
    expect(resolveFieldConfidence({}, null, "vendor.name")).toBeNull();
  });

  it("clamps out-of-range likelihoods", () => {
    expect(resolveFieldConfidence({ a: 1.4 }, null, "a")?.value).toBe(1);
    expect(resolveFieldConfidence({ a: -0.2 }, null, "a")?.value).toBe(0);
    expect(resolveFieldConfidence({ a: Number.NaN }, null, "a")).toBeNull();
  });

  it("tiers on the thresholds the palette keys off", () => {
    expect(confidenceTier(0.9)).toBe("high");
    expect(confidenceTier(0.899)).toBe("medium");
    expect(confidenceTier(0.7)).toBe("medium");
    expect(confidenceTier(0.699)).toBe("low");
  });
});

describe("normalizing raw consensus payloads", () => {
  it("prepends the form data when no consolidated choice is present", () => {
    const normalized = normalizeJsonFormConsensusDetails({ total: 100 }, [
      { message: { parsed: { total: 100 } }, likelihoods: { total: 0.9 } },
      { message: { content: '{"total":105}' } },
    ]);

    expect(normalized.map((choice) => choice.index)).toEqual([0, 1, 2]);
    expect(normalized[0].data).toEqual({ total: 100 });
    expect(normalized[1].likelihoods).toEqual({ total: 0.9 });
    expect(normalized[2].data).toEqual({ total: 105 });
  });

  it("keeps a payload that already carries the consolidated choice", () => {
    const normalized = normalizeJsonFormConsensusDetails({ total: 0 }, [
      { data: { total: 100 }, index: 0 },
      { data: { total: 105 }, index: 1 },
    ]);

    expect(normalized).toHaveLength(2);
    expect(normalized[0].data).toEqual({ total: 100 });
  });

  it("drops unparseable and empty choices", () => {
    expect(
      normalizeJsonFormConsensusDetails({}, [
        { message: { content: "not json" } },
        { data: {} },
      ]),
    ).toEqual([]);
    expect(normalizeJsonFormConsensusDetails({}, undefined)).toEqual([]);
  });
});
