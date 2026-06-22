import { Check, X } from "lucide-react";

import type { CardTone } from "../types";

const FIELDS = [
  {
    label: "invoice_total",
    value: "$12,089.00",
    confidence: 0.41,
    flagged: true,
  },
  {
    label: "vendor_name",
    value: "Acme Industrial",
    confidence: 0.97,
    flagged: false,
  },
  { label: "due_date", value: "2025-03-15", confidence: 0.94, flagged: false },
];

export function HumanInLoopArt({
  tone: _tone = "default",
}: {
  tone?: CardTone;
}) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute inset-0" />

      <div className="absolute inset-0">
        <div className="absolute inset-x-3 top-2 bottom-2 flex flex-col gap-2">
          {/* Flagged extraction */}
          <div className="border-border bg-card rounded-sm border p-3">
            <div className="mb-2">
              <span className="text-foreground/75 text-[11px] font-semibold">
                Extraction result
              </span>
            </div>

            <div className="space-y-2">
              {FIELDS.map((field) => (
                <div
                  key={field.label}
                  className={`flex items-center justify-between rounded-sm px-2.5 py-1.5 text-[10px] ${
                    field.flagged
                      ? "border-warning/35 bg-warning/10 border"
                      : "border-border bg-muted/50 border"
                  }`}
                >
                  <span className="text-muted-foreground font-mono">
                    {field.label}
                  </span>
                  <div className="flex items-center gap-2">
                    <span
                      className={`font-medium ${field.flagged ? "text-warning/90" : "text-foreground/75"}`}
                    >
                      {field.value}
                    </span>
                    <span
                      className={`tabular-nums ${field.flagged ? "text-warning" : "text-muted-foreground/60"}`}
                    >
                      {field.confidence.toFixed(2)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Action */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="border-border bg-card text-muted-foreground flex flex-1 items-center justify-center gap-1.5 rounded-sm border py-2 text-[10px] font-semibold"
              tabIndex={-1}
            >
              <X className="h-3 w-3" />
              Reject
            </button>
            <button
              type="button"
              className="bg-primary text-primary-foreground flex flex-1 items-center justify-center gap-1.5 rounded-sm py-2 text-[10px] font-semibold"
              tabIndex={-1}
            >
              <Check className="h-3 w-3" />
              Approve
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
