"use client"

import * as React from "react"
import {
  AlertCircle,
  Braces,
  CheckCircle2,
  Clock,
  Combine,
  FileText,
  Globe,
  Layers,
  Loader2,
  MinusCircle,
  Network,
  Paperclip,
  RefreshCw,
  ScanText,
  Scissors,
  SquarePen,
  SquareStack,
  SquareTerminal,
  Tags,
  UserCheck,
  type LucideIcon,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  ApiCallInspector,
  type ApiCall,
} from "@/registry/new-york-v4/blocks/api-call-block"
import {
  ConditionalBreakdownTable,
  type ConditionalRun,
} from "@/registry/new-york-v4/blocks/conditional-block"
import {
  FunctionInspector,
  type FunctionRun,
} from "@/registry/new-york-v4/blocks/function-block"

// ── Types ────────────────────────────────────────────────────────────────────

export type StepStatus =
  | "completed"
  | "running"
  | "error"
  | "skipped"
  | "pending"
  | "awaiting_review"

export type RunStep = {
  id: string
  /** Block type — drives the icon and color. Unknown types fall back to a generic icon. */
  blockType: string
  /** Human label for the step. */
  label: string
  status: StepStatus
  /** Execution time in milliseconds. */
  durationMs?: number | null
  /** Secondary line — error message, skip reason, model name, etc. */
  detail?: string
  /** What to render in the detail panel when the step is selected. */
  inspector?: React.ReactNode
}

export type WorkflowRun = {
  steps: RunStep[]
  /** Id of the step selected by default; falls back to the first step. */
  defaultStepId?: string
}

// ── Block-type registry ──────────────────────────────────────────────────────

const BLOCK_META: Record<string, { label: string; icon: LucideIcon; color: string }> = {
  start_document: { label: "Document Input", icon: Paperclip, color: "#22c55e" },
  start_json: { label: "JSON Input", icon: Braces, color: "#2563eb" },
  parse: { label: "Parse", icon: ScanText, color: "#06b6d4" },
  edit: { label: "Edit", icon: SquarePen, color: "#10b981" },
  extract: { label: "Extract", icon: Layers, color: "#8b5cf6" },
  split: { label: "Split", icon: Scissors, color: "#f59e0b" },
  classifier: { label: "Classifier", icon: Tags, color: "#14b8a6" },
  merge_dicts: { label: "Merge JSON", icon: Combine, color: "#6366f1" },
  conditional: { label: "If / Else", icon: Network, color: "#f97316" },
  api_call: { label: "API Call", icon: Globe, color: "#0ea5e9" },
  function: { label: "Function", icon: SquareTerminal, color: "#0f766e" },
  while_loop: { label: "While", icon: RefreshCw, color: "#64748b" },
  for_each: { label: "For Each", icon: SquareStack, color: "#f97316" },
}

function blockMeta(blockType: string) {
  return (
    BLOCK_META[blockType] ?? {
      label: blockType.replace(/_/g, " "),
      icon: FileText,
      color: "#64748b",
    }
  )
}

// ── Status registry ──────────────────────────────────────────────────────────

const STATUS_META: Record<
  StepStatus,
  { label: string; icon: LucideIcon; dot: string; text: string }
> = {
  completed: {
    label: "Completed",
    icon: CheckCircle2,
    dot: "bg-emerald-500",
    text: "text-emerald-600 dark:text-emerald-400",
  },
  running: {
    label: "Running",
    icon: Loader2,
    dot: "bg-blue-500",
    text: "text-blue-600 dark:text-blue-400",
  },
  error: {
    label: "Error",
    icon: AlertCircle,
    dot: "bg-red-500",
    text: "text-red-600 dark:text-red-400",
  },
  awaiting_review: {
    label: "Awaiting review",
    icon: UserCheck,
    dot: "bg-amber-500",
    text: "text-amber-600 dark:text-amber-400",
  },
  skipped: {
    label: "Skipped",
    icon: MinusCircle,
    dot: "bg-muted-foreground",
    text: "text-muted-foreground",
  },
  pending: {
    label: "Pending",
    icon: Clock,
    dot: "bg-muted-foreground",
    text: "text-muted-foreground",
  },
}

function formatDuration(ms: number): string {
  return ms >= 1000 ? `${(ms / 1000).toFixed(2)}s` : `${ms.toFixed(0)}ms`
}

// ── Step row ─────────────────────────────────────────────────────────────────

function StepRow({
  step,
  selected,
  isFirst,
  isLast,
  onSelect,
}: {
  step: RunStep
  selected: boolean
  isFirst: boolean
  isLast: boolean
  onSelect: () => void
}) {
  const block = blockMeta(step.blockType)
  const status = STATUS_META[step.status]
  const BlockIcon = block.icon
  const StatusIcon = status.icon

  const lineClass =
    isFirst && isLast
      ? "hidden"
      : isFirst
        ? "top-1/2 bottom-0"
        : isLast
          ? "top-0 bottom-1/2"
          : "inset-y-0"

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex w-full items-stretch gap-3 px-3 py-2.5 text-left transition-colors",
        selected ? "bg-accent" : "hover:bg-muted/60"
      )}
    >
      {/* Icon + connector */}
      <div className="relative flex w-8 flex-shrink-0 justify-center">
        <span
          className={cn("absolute left-1/2 w-px -translate-x-1/2 bg-border", lineClass)}
        />
        <span
          className="relative z-10 flex size-8 items-center justify-center rounded-lg"
          style={{ backgroundColor: `${block.color}1f`, color: block.color }}
        >
          <BlockIcon className="size-4" />
        </span>
      </div>

      {/* Label + meta */}
      <div className="flex min-w-0 flex-1 flex-col gap-0.5 py-0.5">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium">{step.label}</span>
          {step.durationMs != null && (
            <span className="ml-auto flex-shrink-0 font-mono text-[10px] text-muted-foreground tabular-nums">
              {formatDuration(step.durationMs)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <StatusIcon
            className={cn(
              "size-3",
              status.text,
              step.status === "running" && "animate-spin"
            )}
          />
          <span className={cn("text-[11px]", status.text)}>{status.label}</span>
          <span className="text-[11px] text-muted-foreground/60">·</span>
          <span className="truncate text-[11px] text-muted-foreground">
            {step.detail ?? block.label}
          </span>
        </div>
      </div>
    </button>
  )
}

// ── Detail panel ─────────────────────────────────────────────────────────────

function GenericDetail({ step }: { step: RunStep }) {
  const status = STATUS_META[step.status]
  const StatusIcon = status.icon
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
      <StatusIcon
        className={cn(
          "size-7",
          status.text,
          step.status === "running" && "animate-spin"
        )}
      />
      <span className="text-sm font-medium">{step.label}</span>
      <span className="max-w-sm text-xs text-muted-foreground">
        {step.detail ?? `This step ${status.label.toLowerCase()} — no detailed view.`}
      </span>
    </div>
  )
}

function DetailPanel({ step }: { step: RunStep }) {
  const block = blockMeta(step.blockType)
  const status = STATUS_META[step.status]
  const BlockIcon = block.icon

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      {/* Header */}
      <div className="flex flex-shrink-0 items-center gap-2.5 border-b px-4 py-3">
        <span
          className="flex size-7 items-center justify-center rounded-md"
          style={{ backgroundColor: `${block.color}1f`, color: block.color }}
        >
          <BlockIcon className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{step.label}</div>
          <div className="text-[11px] text-muted-foreground">{block.label}</div>
        </div>
        <span className={cn("flex items-center gap-1.5 text-xs", status.text)}>
          <span className={cn("size-1.5 rounded-full", status.dot)} />
          {status.label}
        </span>
        {step.durationMs != null && (
          <span className="flex items-center gap-1 font-mono text-[11px] text-muted-foreground">
            <Clock className="size-3" />
            {formatDuration(step.durationMs)}
          </span>
        )}
      </div>
      {/* Body */}
      <div className="min-h-0 flex-1 overflow-hidden">
        {step.inspector ?? <GenericDetail step={step} />}
      </div>
    </div>
  )
}

// ── Timeline ─────────────────────────────────────────────────────────────────

/**
 * Workflow run timeline — a vertical list of the steps in a run (block icon,
 * label, status and duration) beside a detail panel that shows the selected
 * step's inspector. Pass a {@link WorkflowRun}; each step's `inspector` is
 * rendered as-is, so any block-type view composes here.
 */
export function RunTimeline({ run }: { run: WorkflowRun }) {
  const { steps } = run
  const [selectedId, setSelectedId] = React.useState(
    run.defaultStepId ?? steps[0]?.id
  )
  const selected = steps.find((s) => s.id === selectedId) ?? steps[0]

  return (
    <div className="flex h-full min-h-0 bg-background">
      {/* Rail */}
      <aside className="flex w-[260px] flex-shrink-0 flex-col border-r">
        <div className="flex h-10 flex-shrink-0 items-center border-b px-4">
          <h2 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
            Run steps
          </h2>
          <span className="ml-auto text-[11px] text-muted-foreground tabular-nums">
            {steps.length}
          </span>
        </div>
        <ScrollArea className="min-h-0 flex-1">
          <div className="py-1">
            {steps.map((step, i) => (
              <StepRow
                key={step.id}
                step={step}
                selected={step.id === selected?.id}
                isFirst={i === 0}
                isLast={i === steps.length - 1}
                onSelect={() => setSelectedId(step.id)}
              />
            ))}
          </div>
        </ScrollArea>
      </aside>

      {/* Detail */}
      <div className="min-w-0 flex-1">
        {selected ? (
          <DetailPanel step={selected} />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            No steps
          </div>
        )}
      </div>
    </div>
  )
}

// ── Block (self-contained demo with sample data) ─────────────────────────────

const API_CALL: ApiCall = {
  url: "https://api.retab.com/v1/documents/extract",
  method: "POST",
  requestHeaders: {
    "Content-Type": "application/json",
    Authorization: "Bearer sk_live_••••8f3a",
  },
  requestBody: {
    model: "retab-large",
    document: { url: "https://files.retab.com/uploads/invoice_8842.pdf" },
  },
  responseStatusCode: 200,
  durationMs: 1842,
  responseHeaders: { "x-request-id": "req_9f2b7c41a8" },
  responseBody: JSON.stringify({
    id: "extr_2Kd9aZ",
    output: { invoice_number: "INV-8842", total_amount: 12480.5, currency: "USD" },
  }),
}

const FUNCTION_RUN: FunctionRun = {
  isSuccess: true,
  message: "Returned Output",
  executionTimeMs: 214,
  language: "python",
  inputData: { invoice_number: "INV-8842", amount: 12480.5, currency: "USD" },
  outputData: {
    invoice_number: "INV-8842",
    subtotal: 12480.5,
    tax: 1060.84,
    total: 13541.34,
    currency: "USD",
  },
  stdout: "Computed tax 1060.84 on subtotal 12480.5",
  code: "def transform(input: Input) -> Output:\n    tax = round(input.amount * 0.085, 2)\n    return Output(total=input.amount + tax, ...)",
}

const CONDITIONAL_RUN: ConditionalRun = {
  selectedBranchId: "else_if_0",
  branches: [
    {
      id: "if",
      kind: "if",
      logicalOperator: "and",
      matched: false,
      subConditions: [
        { path: "data.total_amount", operator: "is_greater_than", expected: 50000, actual: 13541.34, matched: false },
        { path: "data.currency", operator: "is_equal_to", expected: "USD", actual: "USD", matched: true },
      ],
    },
    {
      id: "else_if_0",
      kind: "else_if",
      logicalOperator: "and",
      matched: true,
      subConditions: [
        { path: "data.total_amount", operator: "is_greater_than", expected: 10000, actual: 13541.34, matched: true },
        { path: "data.status", operator: "is_equal_to", expected: "approved", actual: "approved", matched: true },
      ],
    },
    { id: "else", kind: "else", matched: true, skipped: true },
  ],
}

const FAILED_CALL: ApiCall = {
  url: "https://erp.acme.com/api/v2/invoices",
  method: "POST",
  requestHeaders: { "Content-Type": "application/json" },
  requestBody: { invoice_number: "INV-8842", total: 13541.34 },
  responseStatusCode: 503,
  durationMs: 4120,
  error: "503 Service Unavailable — upstream did not respond in time",
  responseBody: null,
}

const SAMPLE_RUN: WorkflowRun = {
  defaultStepId: "extract",
  steps: [
    {
      id: "input",
      blockType: "start_document",
      label: "Upload invoice",
      status: "completed",
      durationMs: 8,
      detail: "invoice_8842.pdf",
    },
    {
      id: "extract",
      blockType: "api_call",
      label: "Extract fields",
      status: "completed",
      durationMs: 1842,
      inspector: <ApiCallInspector call={API_CALL} />,
    },
    {
      id: "totals",
      blockType: "function",
      label: "Compute totals",
      status: "completed",
      durationMs: 214,
      inspector: <FunctionInspector run={FUNCTION_RUN} />,
    },
    {
      id: "route",
      blockType: "conditional",
      label: "Route by amount",
      status: "completed",
      durationMs: 3,
      inspector: <ConditionalBreakdownTable run={CONDITIONAL_RUN} />,
    },
    {
      id: "post",
      blockType: "api_call",
      label: "Post to ERP",
      status: "error",
      durationMs: 4120,
      detail: "503 Service Unavailable",
      inspector: <ApiCallInspector call={FAILED_CALL} />,
    },
    {
      id: "notify",
      blockType: "function",
      label: "Send notification",
      status: "skipped",
      detail: "Upstream step failed",
    },
  ],
}

/**
 * Run timeline block — a workflow run rendered as a step list beside a live
 * inspector, preloaded with a sample run that exercises the API Call, Function
 * and If / Else inspectors. Pass your own {@link WorkflowRun} via `run`.
 */
export function RunTimelineBlock({ run = SAMPLE_RUN }: { run?: WorkflowRun }) {
  return (
    <div className="h-full min-h-[480px]">
      <RunTimeline run={run} />
    </div>
  )
}
