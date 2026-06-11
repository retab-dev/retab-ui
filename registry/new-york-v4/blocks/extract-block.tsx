"use client"

import * as React from "react"
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Coins,
  Layers,
  Loader2,
  Sparkles,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { JsonInspector } from "@/components/ui/json-inspector"

// ── Types ────────────────────────────────────────────────────────────────────

export type TokenUsage = {
  promptTokens?: number | null
  completionTokens?: number | null
  totalTokens?: number | null
  /** Retab credits consumed. */
  credits?: number | null
}

export type ExtractRun = {
  /** Model that produced the extraction, e.g. "retab-large". */
  model: string
  status?: "completed" | "running" | "error"
  /** Wall-clock time in milliseconds. */
  durationMs?: number | null
  usage?: TokenUsage
  /** Number of consensus votes, shown when greater than 1. */
  nConsensus?: number
  /** Model reasoning / chain of thought, shown in its own tab when present. */
  reasoning?: string | null
  /** The structured output object. */
  output: Record<string, unknown>
  /** Per-field confidence in [0,1], keyed by dotted path (e.g. `vendor.vat_id`). */
  likelihoods?: Record<string, number> | null
  error?: string | null
}

// ── Helpers ──────────────────────────────────────────────────────────────────

type Leaf = { path: string; value: unknown }

/** Flatten an object/array to leaf entries keyed by dotted path. */
function flatten(value: unknown, prefix = "", out: Leaf[] = []): Leaf[] {
  if (Array.isArray(value)) {
    if (value.length === 0) out.push({ path: prefix, value: [] })
    value.forEach((item, i) => flatten(item, `${prefix}[${i}]`, out))
  } else if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
    if (entries.length === 0) out.push({ path: prefix, value: {} })
    for (const [key, v] of entries) {
      flatten(v, prefix ? `${prefix}.${key}` : key, out)
    }
  } else {
    out.push({ path: prefix, value })
  }
  return out
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "—"
  if (typeof value === "string") return value === "" ? "—" : value
  if (Array.isArray(value)) return "[]"
  if (typeof value === "object") return "{}"
  return String(value)
}

function confidenceTone(value: number): string {
  if (value >= 0.9)
    return "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400"
  if (value >= 0.7)
    return "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400"
  return "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400"
}

function formatNumber(n: number): string {
  return n.toLocaleString("en-US")
}

function formatDuration(ms: number): string {
  return ms >= 1000 ? `${(ms / 1000).toFixed(2)}s` : `${Math.round(ms)}ms`
}

// ── Small pieces ─────────────────────────────────────────────────────────────

function ConfidenceTablet({ value }: { value: number }) {
  return (
    <span
      className={cn(
        "flex-shrink-0 rounded px-1.5 py-0.5 font-mono text-[10px] font-medium tabular-nums",
        confidenceTone(value)
      )}
      title={`Confidence ${(value * 100).toFixed(1)}%`}
    >
      {Math.round(value * 100)}%
    </span>
  )
}

function UsageChip({
  icon,
  label,
  value,
}: {
  icon?: React.ReactNode
  label: string
  value: string
}) {
  return (
    <span className="flex items-center gap-1 text-xs text-muted-foreground">
      {icon}
      <span className="font-mono tabular-nums text-foreground/80">{value}</span>
      <span className="text-muted-foreground/70">{label}</span>
    </span>
  )
}

function FieldsView({
  output,
  likelihoods,
}: {
  output: Record<string, unknown>
  likelihoods?: Record<string, number> | null
}) {
  const leaves = React.useMemo(() => flatten(output), [output])

  return (
    <ScrollArea className="h-full">
      <div className="divide-y">
        {leaves.map((leaf) => {
          const confidence = likelihoods?.[leaf.path]
          return (
            <div key={leaf.path} className="flex items-start gap-3 px-3 py-2">
              <span className="w-44 flex-shrink-0 truncate font-mono text-[11px] text-muted-foreground">
                {leaf.path}
              </span>
              <span className="min-w-0 flex-1 text-sm break-words text-foreground/90">
                {formatValue(leaf.value)}
              </span>
              {confidence != null && <ConfidenceTablet value={confidence} />}
            </div>
          )
        })}
      </div>
    </ScrollArea>
  )
}

// ── Inspector ────────────────────────────────────────────────────────────────

/**
 * Inspect a single LLM extraction — the model, token usage and duration up top,
 * then the extracted fields with per-field confidence, the raw JSON, and the
 * model's reasoning. Pass an {@link ExtractRun}; presentation only.
 */
export function ExtractInspector({ run }: { run: ExtractRun }) {
  const {
    model,
    status = "completed",
    durationMs,
    usage,
    nConsensus,
    reasoning,
    output,
    likelihoods,
    error,
  } = run

  const isError = status === "error" || !!error
  const isRunning = status === "running"

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-background">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b bg-muted/40 px-4 py-3">
        <span className="flex items-center gap-1.5 rounded-md bg-violet-100 px-2 py-1 text-xs font-semibold text-violet-700 dark:bg-violet-950/50 dark:text-violet-400">
          <Layers className="size-3.5" />
          {model}
        </span>
        {nConsensus != null && nConsensus > 1 && (
          <UsageChip
            icon={<Sparkles className="size-3.5" />}
            label="consensus"
            value={`×${nConsensus}`}
          />
        )}
        {usage?.promptTokens != null && (
          <UsageChip label="prompt" value={formatNumber(usage.promptTokens)} />
        )}
        {usage?.completionTokens != null && (
          <UsageChip
            label="completion"
            value={formatNumber(usage.completionTokens)}
          />
        )}
        {usage?.totalTokens != null && (
          <UsageChip label="tokens" value={formatNumber(usage.totalTokens)} />
        )}
        {usage?.credits != null && (
          <UsageChip
            icon={<Coins className="size-3.5" />}
            label="credits"
            value={formatNumber(usage.credits)}
          />
        )}
        <div className="ml-auto flex items-center gap-3">
          {durationMs != null && (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="size-3.5" />
              <span className="font-mono tabular-nums">
                {formatDuration(durationMs)}
              </span>
            </span>
          )}
          <span
            className={cn(
              "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
              isError
                ? "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-400"
                : isRunning
                  ? "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-400"
                  : "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-400"
            )}
          >
            {isError ? (
              <AlertTriangle className="size-3" />
            ) : isRunning ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <CheckCircle2 className="size-3" />
            )}
            {isError ? "Error" : isRunning ? "Extracting" : "Extracted"}
          </span>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-3 border-b border-red-200 bg-red-50 px-4 py-3 dark:border-red-900 dark:bg-red-950/40">
          <AlertTriangle className="size-4 flex-shrink-0 text-red-600 dark:text-red-400" />
          <span className="text-sm text-red-700 dark:text-red-400">{error}</span>
        </div>
      )}

      {/* Tabs */}
      <Tabs
        defaultValue="fields"
        className="flex min-h-0 flex-1 flex-col gap-0 overflow-hidden"
      >
        <TabsList
          variant="underline"
          className="w-full flex-shrink-0 justify-start rounded-none border-b bg-transparent px-2"
        >
          <TabsTrigger value="fields" className="text-xs">
            Fields
          </TabsTrigger>
          <TabsTrigger value="json" className="text-xs">
            JSON
          </TabsTrigger>
          {reasoning && (
            <TabsTrigger value="reasoning" className="text-xs">
              Reasoning
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="fields" className="m-0 min-h-0 flex-1 overflow-hidden">
          <FieldsView output={output} likelihoods={likelihoods} />
        </TabsContent>
        <TabsContent value="json" className="m-0 min-h-0 flex-1 overflow-hidden">
          <JsonInspector data={output} />
        </TabsContent>
        {reasoning && (
          <TabsContent
            value="reasoning"
            className="m-0 min-h-0 flex-1 overflow-hidden"
          >
            <ScrollArea className="h-full">
              <p className="p-4 text-sm leading-relaxed whitespace-pre-wrap text-foreground/80">
                {reasoning}
              </p>
            </ScrollArea>
          </TabsContent>
        )}
      </Tabs>
    </div>
  )
}

// ── Block (self-contained demo with sample data) ─────────────────────────────

const SAMPLE_RUN: ExtractRun = {
  model: "retab-large",
  status: "completed",
  durationMs: 1842,
  nConsensus: 3,
  usage: {
    promptTokens: 4210,
    completionTokens: 388,
    totalTokens: 4598,
    credits: 3,
  },
  reasoning:
    "Read the header block for the invoice number and dates, then the vendor panel top-left for the legal name and VAT id (the VAT id was partly obscured, lowering confidence). Totals were taken from the summary table at the bottom; the two line items map to the itemized rows above it.",
  output: {
    invoice_number: "INV-8842",
    vendor: { name: "Acme Corp", vat_id: "FR12345678901" },
    issue_date: "2026-06-02",
    due_date: "2026-07-15",
    currency: "USD",
    total_amount: 12480.5,
    line_items: [
      { description: "Pro plan — annual", quantity: 1, amount: 9600 },
      { description: "Overage — API calls", quantity: 3, amount: 2880.5 },
    ],
  },
  likelihoods: {
    invoice_number: 0.99,
    "vendor.name": 0.97,
    "vendor.vat_id": 0.62,
    issue_date: 0.95,
    due_date: 0.93,
    currency: 0.99,
    total_amount: 0.98,
    "line_items[0].description": 0.96,
    "line_items[0].quantity": 0.99,
    "line_items[0].amount": 0.94,
    "line_items[1].description": 0.88,
    "line_items[1].quantity": 0.91,
    "line_items[1].amount": 0.74,
  },
}

/**
 * Extract block — an inspector for a single LLM extraction, preloaded with a
 * sample invoice extraction (model, token usage, per-field confidence and
 * reasoning). Pass your own {@link ExtractRun} via the `run` prop.
 */
export function ExtractBlock({ run = SAMPLE_RUN }: { run?: ExtractRun }) {
  return (
    <div className="h-full min-h-[420px]">
      <ExtractInspector run={run} />
    </div>
  )
}
