"use client";

/* eslint-disable no-restricted-syntax -- TODO(no-useEffect): existing direct React effect usage; migrate to useMountEffect or a Rule 1-5 replacement. */

import * as React from "react";
import type { JSONSchema7 } from "json-schema";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { JsonForm } from "@/components/json-form/json-form";

const DEFAULT_ROW_COUNT = 50_000;
const ROW_COUNT_OPTIONS = [10_000, 50_000, 100_000] as const;

const schema = {
  type: "object",
  title: "Large property portfolio",
  properties: {
    properties: {
      type: "array",
      title: "Properties",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          property_id: { type: "string", title: "Property ID" },
          market: { type: "string", title: "Market" },
          asset_class: { type: "string", title: "Class" },
          units: { type: "integer", title: "Units" },
          occupancy_rate: { type: "number", title: "Occupancy" },
          annual_revenue: { type: "number", title: "Revenue" },
          is_flagged: { type: "boolean", title: "Flagged" },
        },
        required: [
          "property_id",
          "market",
          "asset_class",
          "units",
          "occupancy_rate",
          "annual_revenue",
          "is_flagged",
        ],
      },
    },
  },
  required: ["properties"],
} satisfies JSONSchema7;

type LargeArrayValues = {
  properties: Array<{
    property_id: string;
    market: string;
    asset_class: string;
    units: number;
    occupancy_rate: number;
    annual_revenue: number;
    is_flagged: boolean;
  }>;
};

export function JsonFormLargeArraySample() {
  const [rowCount, setRowCount] = React.useState(DEFAULT_ROW_COUNT);
  const defaultValues = React.useMemo(
    () => createLargeArrayValues(rowCount),
    [rowCount],
  );
  const form = useForm<Record<string, unknown>>({
    defaultValues: defaultValues as unknown as Record<string, unknown>,
    mode: "onBlur",
  });

  React.useEffect(() => {
    form.reset(defaultValues as unknown as Record<string, unknown>);
  }, [defaultValues, form]);

  return (
    <main className="bg-background text-foreground flex h-svh min-h-0 flex-col">
      <header className="flex min-h-14 flex-wrap items-center gap-3 border-b px-4 py-2">
        <div className="min-w-0">
          <h1 className="text-sm leading-5 font-semibold">
            JSON Form large array
          </h1>
          <p className="text-muted-foreground text-xs">
            {rowCount.toLocaleString()} property rows
          </p>
        </div>

        <div className="ml-auto flex items-center gap-2">
          {ROW_COUNT_OPTIONS.map((option) => (
            <Button
              key={option}
              type="button"
              size="sm"
              variant={rowCount === option ? "default" : "outline"}
              onClick={() => setRowCount(option)}
            >
              {option.toLocaleString()}
            </Button>
          ))}
        </div>
      </header>

      <section className="min-h-0 flex-1 overflow-auto p-4">
        <JsonForm
          form={form}
          schema={schema}
          defaultOpenPaths={["properties"]}
          className="mx-auto max-w-7xl"
        />
      </section>
    </main>
  );
}

function createLargeArrayValues(rowCount: number): LargeArrayValues {
  const markets = [
    "Austin",
    "Boston",
    "Chicago",
    "Denver",
    "Miami",
    "Phoenix",
    "Seattle",
    "Toronto",
  ];
  const assetClasses = ["Office", "Retail", "Industrial", "Multifamily"];

  return {
    properties: Array.from({ length: rowCount }, (_, index) => {
      const sequence = index + 1;
      const units = 12 + ((index * 17) % 360);
      const occupancyBasisPoints = 7200 + ((index * 43) % 2700);
      return {
        property_id: `prop_${String(sequence).padStart(6, "0")}`,
        market: markets[index % markets.length],
        asset_class: assetClasses[index % assetClasses.length],
        units,
        occupancy_rate: occupancyBasisPoints / 100,
        annual_revenue: Math.round(units * (1500 + ((index * 29) % 1200)) * 12),
        is_flagged: index % 97 === 0,
      };
    }),
  };
}
