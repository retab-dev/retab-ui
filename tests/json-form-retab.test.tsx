// @vitest-environment jsdom
import * as React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import type { JSONSchema7 } from "json-schema";
import { useForm } from "react-hook-form";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import type { ConsensusChoice } from "@/components/json-form-retab/field-metadata-core";
import { JsonFormRetab } from "@/components/json-form-retab/json-form-retab";

beforeAll(() => {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  HTMLElement.prototype.scrollIntoView = vi.fn();
});

afterEach(cleanup);

const schema: JSONSchema7 = {
  type: "object",
  properties: {
    vendor_name: { type: "string" },
    total: { type: "number" },
    remitter: {
      type: "object",
      properties: { name: { type: "string" } },
    },
  },
};

const data = {
  vendor_name: "Acme",
  reasoning___vendor_name: "Taken from the letterhead.",
  total: 100,
  remitter: { name: "Acme", reasoning___name: "Signature block." },
};

const consensusDetails: ConsensusChoice[] = [
  { data, index: 0 },
  { data, index: 1 },
  { data, index: 2 },
  {
    data: {
      ...data,
      vendor_name: "Acme Inc.",
      reasoning___vendor_name: "Used the registered entity name.",
    },
    index: 3,
  },
  { data: { ...data, vendor_name: "Acme" }, index: 4 },
];

function Harness(
  props: Omit<React.ComponentProps<typeof JsonFormRetab>, "form" | "schema">,
) {
  const form = useForm<Record<string, unknown>>({ defaultValues: data });
  return <JsonFormRetab form={form} schema={schema} {...props} />;
}

function meters() {
  return screen
    .queryAllByRole("meter")
    .map((meter) => [
      meter.getAttribute("aria-valuenow"),
      meter.dataset.confidenceTier,
    ]);
}

describe("JsonFormRetab metadata layers", () => {
  it("renders nothing extra when every layer is off", () => {
    render(<Harness />);

    expect(screen.queryAllByRole("meter")).toHaveLength(0);
    expect(document.querySelectorAll(".lucide-atom")).toHaveLength(0);
  });

  it("marks fields that carry a reasoning trace", () => {
    render(<Harness showReasoning />);

    // vendor_name and remitter.name have traces; total does not.
    expect(document.querySelectorAll(".lucide-atom")).toHaveLength(2);
  });

  it("prefers likelihoods over consensus agreement, and tiers both", () => {
    render(
      <Harness
        showConfidence
        consensusDetails={consensusDetails}
        likelihoods={{ total: 0.62 }}
      />,
    );

    // vendor_name: 3 of 4 runs agree. total: explicit likelihood.
    // remitter / remitter.name: full agreement.
    expect(meters()).toEqual([
      ["75", "medium"],
      ["62", "low"],
      ["100", "high"],
      ["100", "high"],
    ]);
  });

  it("reports agreement in the confidence label", () => {
    render(<Harness showConfidence consensusDetails={consensusDetails} />);

    expect(screen.getAllByRole("meter")[0].getAttribute("aria-valuenow")).toBe(
      "75",
    );
  });

  it("shows no confidence without a likelihood or a consensus run", () => {
    render(<Harness showConfidence />);

    expect(screen.queryAllByRole("meter")).toHaveLength(0);
  });

  it("swaps the single reasoning badge for the per-model one under consensus", () => {
    const { rerender } = render(<Harness showReasoning />);
    expect(document.querySelectorAll(".lucide-atom")).toHaveLength(2);

    rerender(
      <Harness
        showReasoning
        showConsensus
        consensusDetails={consensusDetails}
      />,
    );

    // The atom now reads per-model reasoning off the runs rather than the form
    // value, so it stays on the two leaves whose runs carry a trace; the blend
    // badge marks every field the consensus covers, including the object node.
    expect(document.querySelectorAll(".lucide-atom")).toHaveLength(2);
    expect(document.querySelectorAll(".lucide-blend")).toHaveLength(4);
  });
});
