"use client";

import * as React from "react";
import { Atom, Blend, Gauge } from "lucide-react";
import type { JSONSchema7 } from "json-schema";
import { useForm } from "react-hook-form";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { TooltipProvider } from "@/components/ui/tooltip";
import { JsonFormRetab } from "@/components/json-form-retab/json-form-retab";
import { sampleConsensusDetails } from "@/components/json-form-retab/sample/consensus";
import sampleData from "@/components/json-form-retab/sample/data.json";
import sampleLikelihoods from "@/components/json-form-retab/sample/likelihoods.json";
import sampleSchema from "@/components/json-form-retab/sample/schema.json";

// A mortgage deed extracted five times by a consensus (k-LLM) run: the parties
// and amounts land every time, the condominium regime never does.
const schema = sampleSchema as JSONSchema7;
const defaultValues = sampleData as Record<string, unknown>;
const likelihoods = sampleLikelihoods as Record<string, number>;

const LAYERS = [
  {
    key: "reasoning",
    label: "Reasoning",
    icon: Atom,
    hint: "Why the model answered this way",
  },
  {
    key: "consensus",
    label: "Consensus",
    icon: Blend,
    hint: "What each of the 4 runs answered",
  },
  {
    key: "confidence",
    label: "Confidence",
    icon: Gauge,
    hint: "Model likelihood, or agreement across runs",
  },
] as const;

type LayerKey = (typeof LAYERS)[number]["key"];

export function JsonFormRetabDemo() {
  const form = useForm<Record<string, unknown>>({
    defaultValues,
    mode: "onBlur",
  });
  const [layers, setLayers] = React.useState<Record<LayerKey, boolean>>({
    reasoning: true,
    consensus: true,
    confidence: true,
  });
  const activeHint =
    LAYERS.find((layer) => layers[layer.key])?.hint ??
    "Every metadata layer is off — this is the plain form";

  return (
    <TooltipProvider delayDuration={200}>
      <div className="not-prose bg-card w-full overflow-hidden rounded-xl border shadow-sm">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
          <div className="min-w-0">
            <h2 className="truncate text-sm font-medium">Mortgage Deed</h2>
            <p className="text-muted-foreground truncate text-xs">
              {activeHint}
            </p>
          </div>
          <div className="bg-muted/40 flex items-center gap-1 rounded-lg border p-1">
            {LAYERS.map(({ key, label, icon: Icon }) => {
              const active = layers[key];
              return (
                <Button
                  key={key}
                  type="button"
                  size="xs"
                  variant={active ? "secondary" : "ghost"}
                  aria-pressed={active}
                  onClick={() =>
                    setLayers((current) => ({ ...current, [key]: !active }))
                  }
                  className={cn(
                    "gap-1.5",
                    active
                      ? "text-foreground shadow-xs"
                      : "text-muted-foreground",
                  )}
                >
                  <Icon className={cn(active && "text-info")} />
                  {label}
                </Button>
              );
            })}
          </div>
        </header>
        <div className="max-h-[640px] overflow-auto p-4">
          <JsonFormRetab
            form={form}
            schema={schema}
            consensusDetails={
              layers.consensus ? sampleConsensusDetails : undefined
            }
            likelihoods={likelihoods}
            showConfidence={layers.confidence}
            showConsensus={layers.consensus}
            showReasoning={layers.reasoning}
          />
        </div>
      </div>
    </TooltipProvider>
  );
}
