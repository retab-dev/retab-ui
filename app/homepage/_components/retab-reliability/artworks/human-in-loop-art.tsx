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

const FLAGGED_FIELD = FIELDS[0];

export function HumanInLoopArt({
  tone: _tone = "default",
}: {
  tone?: CardTone;
}) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute inset-0" />

      <div className="absolute inset-0">
        <div className="absolute inset-x-2 top-0 bottom-1 grid grid-rows-[auto_auto] content-start gap-1.5 sm:hidden">
          <div className="border-warning/35 bg-warning/10 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-1 rounded-sm border px-2 py-1.5">
            <div className="min-w-0">
              <div className="text-muted-foreground truncate font-mono text-[10px] leading-4">
                {FLAGGED_FIELD.label}
              </div>
            </div>
            <div className="bg-warning/15 text-warning rounded-sm px-1.5 py-1 font-mono text-[10px] leading-none font-semibold tabular-nums">
              {FLAGGED_FIELD.confidence.toFixed(2)}
            </div>
          </div>

          <div className="grid shrink-0 grid-cols-2 gap-1.5">
            <button
              type="button"
              className="border-border bg-card text-muted-foreground flex min-w-0 items-center justify-center gap-1 rounded-sm border py-1.5 text-[10px] leading-none font-semibold"
              tabIndex={-1}
            >
              <X className="h-3 w-3 shrink-0" />
              <span className="truncate">Reject</span>
            </button>
            <button
              type="button"
              className="bg-primary text-primary-foreground flex min-w-0 items-center justify-center gap-1 rounded-sm py-1.5 text-[10px] leading-none font-semibold"
              tabIndex={-1}
            >
              <Check className="h-3 w-3 shrink-0" />
              <span className="truncate">Approve</span>
            </button>
          </div>
        </div>

        <div className="absolute inset-x-3 top-2 bottom-2 hidden min-h-0 flex-col gap-2 sm:flex">
          <div className="bg-card min-h-0 flex-1 overflow-hidden rounded-sm p-3">
            <div className="mb-1.5 sm:mb-2">
              <span className="text-foreground/75 text-[11px] font-semibold">
                Extraction result
              </span>
            </div>

            <div className="space-y-1.5 sm:space-y-2">
              {FIELDS.map((field) => (
                <div
                  key={field.label}
                  className={`grid grid-cols-[minmax(0,0.45fr)_minmax(0,0.55fr)] items-center gap-1 rounded-sm px-2 py-1.5 text-[10px] ${
                    field.flagged
                      ? "border-warning/35 bg-warning/10 border"
                      : "border-border bg-muted/50 border"
                  }`}
                >
                  <span className="text-muted-foreground min-w-0 truncate font-mono">
                    {field.label}
                  </span>
                  <div className="flex min-w-0 items-center justify-end gap-1">
                    <span
                      className={`min-w-0 truncate text-right font-medium ${field.flagged ? "text-warning/90" : "text-foreground/75"}`}
                    >
                      {field.value}
                    </span>
                    <span
                      className={`hidden shrink-0 tabular-nums sm:inline ${field.flagged ? "text-warning" : "text-muted-foreground/60"}`}
                    >
                      {field.confidence.toFixed(2)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2 px-3">
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
