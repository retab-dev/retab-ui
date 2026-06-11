"use client"

import * as React from "react"
import {
  Braces,
  ChevronDown,
  ChevronRight,
  Combine,
  FileText,
  Globe,
  Layers,
  Network,
  Paperclip,
  RefreshCw,
  ScanText,
  Scissors,
  SquarePen,
  SquareStack,
  SquareTerminal,
  Tags,
  type LucideIcon,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

// ── Types ────────────────────────────────────────────────────────────────────

export type WaterfallStatus =
  | "completed"
  | "running"
  | "error"
  | "skipped"
  | "pending"
  | "awaiting_review"

export type WaterfallStep = {
  id: string
  label: string
  /** Block type — drives the icon. Unknown types fall back to a generic icon. */
  blockType: string
  status: WaterfallStatus
  /** Offset from the start of the run, in milliseconds. */
  startOffsetMs: number
  /** Execution time in milliseconds. */
  durationMs: number
  /** Render as an expandable container (loop) with nested rows beneath. */
  container?: boolean
  /** Nested iterations / sub-steps for container rows. */
  children?: WaterfallStep[]
}

export type WaterfallRun = {
  steps: WaterfallStep[]
  /** Total run duration; computed from the steps when omitted. */
  totalDurationMs?: number
}

// ── Block icons ──────────────────────────────────────────────────────────────

const BLOCK_ICONS: Record<string, LucideIcon> = {
  start_document: Paperclip,
  start_json: Braces,
  parse: ScanText,
  edit: SquarePen,
  extract: Layers,
  split: Scissors,
  classifier: Tags,
  merge_dicts: Combine,
  conditional: Network,
  api_call: Globe,
  function: SquareTerminal,
  while_loop: RefreshCw,
  for_each: SquareStack,
}

function blockIcon(blockType: string): LucideIcon {
  return BLOCK_ICONS[blockType] ?? FileText
}

// ── Status / container colors ────────────────────────────────────────────────

const STATUS_BAR: Record<WaterfallStatus, string> = {
  completed:
    "bg-emerald-200 border-emerald-300 dark:bg-emerald-900/50 dark:border-emerald-700",
  running:
    "bg-blue-200 border-blue-300 dark:bg-blue-900/50 dark:border-blue-700",
  error: "bg-red-200 border-red-300 dark:bg-red-900/50 dark:border-red-700",
  awaiting_review:
    "bg-amber-200 border-amber-300 dark:bg-amber-900/50 dark:border-amber-700",
  pending: "bg-muted border-border",
  skipped: "bg-muted/60 border-border",
}

const CONTAINER_BAR: Record<string, string> = {
  for_each:
    "bg-cyan-100 border-cyan-300 dark:bg-cyan-900/40 dark:border-cyan-700",
  while_loop:
    "bg-orange-100 border-orange-300 dark:bg-orange-900/40 dark:border-orange-700",
}

const STATUS_TEXT: Record<WaterfallStatus, string> = {
  completed: "text-emerald-600 dark:text-emerald-400",
  running: "text-blue-600 dark:text-blue-400",
  error: "text-red-600 dark:text-red-400",
  awaiting_review: "text-amber-600 dark:text-amber-400",
  pending: "text-muted-foreground",
  skipped: "text-muted-foreground",
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${(ms / 60000).toFixed(1)}m`
}

/** Latest end-of-step across the (possibly nested) tree. */
function runEnd(steps: WaterfallStep[]): number {
  let end = 0
  for (const step of steps) {
    end = Math.max(end, step.startOffsetMs + step.durationMs)
    if (step.children?.length) end = Math.max(end, runEnd(step.children))
  }
  return end
}

function longestStep(
  steps: WaterfallStep[],
  best: WaterfallStep | null = null
): WaterfallStep | null {
  for (const step of steps) {
    if (!step.container && (!best || step.durationMs > best.durationMs)) {
      best = step
    }
    if (step.children?.length) best = longestStep(step.children, best)
  }
  return best
}

// ── Row ──────────────────────────────────────────────────────────────────────

const LABEL_COL = "w-36 flex-shrink-0"
const DURATION_COL = "w-14 flex-shrink-0"

function Bar({
  percentStart,
  percentWidth,
  className,
}: {
  percentStart: number
  percentWidth: number
  className: string
}) {
  return (
    <div className="relative h-4 flex-1">
      <div className="absolute inset-0 rounded bg-muted/50" />
      <div
        className={cn("absolute h-full rounded border", className)}
        style={{
          left: `${percentStart}%`,
          width: `${Math.max(percentWidth, 0.5)}%`,
        }}
      />
    </div>
  )
}

function LeafRow({
  step,
  total,
}: {
  step: WaterfallStep
  total: number
}) {
  const Icon = blockIcon(step.blockType)
  return (
    <div className="group flex h-7 items-center gap-3">
      <Tooltip>
        <TooltipTrigger
          className={cn(
            LABEL_COL,
            "flex items-center gap-1.5 truncate pr-2 text-left text-xs text-muted-foreground"
          )}
        >
          <Icon className="size-3 flex-shrink-0 text-muted-foreground/70" />
          <span className="truncate">{step.label}</span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <div className="space-y-0.5 py-0.5">
            <p className="font-medium text-popover-foreground">{step.label}</p>
            <p className="text-muted-foreground">Type: {step.blockType}</p>
            <p className="text-muted-foreground">
              Duration: {formatDuration(step.durationMs)}
            </p>
            <p className="text-muted-foreground">
              Started: +{formatDuration(step.startOffsetMs)}
            </p>
            <p className={cn("capitalize", STATUS_TEXT[step.status])}>
              {step.status.replace(/_/g, " ")}
            </p>
          </div>
        </TooltipContent>
      </Tooltip>
      <Bar
        percentStart={(step.startOffsetMs / total) * 100}
        percentWidth={(step.durationMs / total) * 100}
        className={cn(
          STATUS_BAR[step.status],
          "transition-shadow group-hover:ring-2 group-hover:ring-ring/40 group-hover:ring-offset-1 group-hover:ring-offset-background"
        )}
      />
      <div
        className={cn(
          DURATION_COL,
          "text-right font-mono text-[11px] text-muted-foreground tabular-nums"
        )}
      >
        {formatDuration(step.durationMs)}
      </div>
    </div>
  )
}

function ContainerRow({
  step,
  total,
  expanded,
  onToggle,
}: {
  step: WaterfallStep
  total: number
  expanded: boolean
  onToggle: () => void
}) {
  const Icon = blockIcon(step.blockType)
  const Chevron = expanded ? ChevronDown : ChevronRight
  const count = step.children?.length ?? 0
  return (
    <button
      type="button"
      onClick={onToggle}
      className="group flex h-7 w-full items-center gap-3 rounded text-left transition-colors hover:bg-muted/50"
    >
      <div className={cn(LABEL_COL, "flex items-center gap-1 pr-2")}>
        <Icon className="size-3 flex-shrink-0 text-muted-foreground/70" />
        <span className="truncate text-xs font-medium text-foreground/80">
          {step.label}
        </span>
        <Chevron className="size-3 flex-shrink-0 text-muted-foreground/70" />
      </div>
      <Bar
        percentStart={(step.startOffsetMs / total) * 100}
        percentWidth={(step.durationMs / total) * 100}
        className={CONTAINER_BAR[step.blockType] ?? CONTAINER_BAR.for_each}
      />
      <div
        className={cn(
          DURATION_COL,
          "flex items-center justify-end gap-1 text-right font-mono text-[11px] text-muted-foreground tabular-nums"
        )}
      >
        {count > 0 && (
          <span className="text-muted-foreground/60">×{count}</span>
        )}
        {formatDuration(step.durationMs)}
      </div>
    </button>
  )
}

function WaterfallNode({
  step,
  total,
}: {
  step: WaterfallStep
  total: number
}) {
  const [expanded, setExpanded] = React.useState(true)

  if (!step.container) {
    return <LeafRow step={step} total={total} />
  }

  return (
    <div>
      <ContainerRow
        step={step}
        total={total}
        expanded={expanded}
        onToggle={() => setExpanded((e) => !e)}
      />
      {expanded && (step.children?.length ?? 0) > 0 && (
        <div className="mt-0.5 mb-1 ml-3 space-y-0.5 border-l pl-3">
          {step.children!.map((child) => (
            <WaterfallNode key={child.id} step={child} total={total} />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Waterfall ────────────────────────────────────────────────────────────────

/**
 * Step waterfall — each step as a horizontal bar positioned by its start offset
 * and sized by its duration along a shared time axis, with expandable container
 * (loop) rows. The latencies-at-a-glance view from the logs UI. Pass a
 * {@link WaterfallRun}; presentation only.
 */
export function StepWaterfall({ run }: { run: WaterfallRun }) {
  const { steps } = run
  const total = run.totalDurationMs ?? runEnd(steps)

  if (steps.length === 0 || total <= 0) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-sm text-muted-foreground">
        No timing data available
      </div>
    )
  }

  const slowest = longestStep(steps)
  const totalLabel = formatDuration(total)

  return (
    <TooltipProvider delay={120}>
      <div className="flex h-full min-h-0 flex-col bg-background p-4">
        {/* Header */}
        <div className="flex flex-shrink-0 items-center justify-between border-b pb-2 text-xs text-muted-foreground">
          <span className="font-medium">Step timing waterfall</span>
          <span className="tabular-nums">Total: {totalLabel}</span>
        </div>

        {/* Time axis */}
        <div className="flex flex-shrink-0 items-center gap-3 py-2 text-[10px] text-muted-foreground/70">
          <div className={LABEL_COL} />
          <div className="flex flex-1 justify-between tabular-nums">
            <span>0</span>
            <span>{formatDuration(total / 4)}</span>
            <span>{formatDuration(total / 2)}</span>
            <span>{formatDuration((total * 3) / 4)}</span>
            <span>{totalLabel}</span>
          </div>
          <div className={DURATION_COL} />
        </div>

        {/* Tree */}
        <ScrollArea className="-mr-2 min-h-0 flex-1 pr-2">
          <div className="space-y-0.5 py-1">
            {steps.map((step) => (
              <WaterfallNode key={step.id} step={step} total={total} />
            ))}
          </div>
        </ScrollArea>

        {/* Slowest step */}
        {slowest && (
          <div className="flex-shrink-0 border-t pt-2 text-xs text-muted-foreground">
            <span className="text-muted-foreground/70">Slowest step: </span>
            <span className="font-medium text-foreground/80">
              {slowest.label}
            </span>{" "}
            <span className="text-muted-foreground/70 tabular-nums">
              ({formatDuration(slowest.durationMs)})
            </span>
          </div>
        )}
      </div>
    </TooltipProvider>
  )
}

// ── Block (self-contained demo with sample data) ─────────────────────────────

const SAMPLE_RUN: WaterfallRun = {
  steps: [
    {
      id: "upload",
      label: "Upload invoice",
      blockType: "start_document",
      status: "completed",
      startOffsetMs: 0,
      durationMs: 8,
    },
    {
      id: "parse",
      label: "Parse PDF",
      blockType: "parse",
      status: "completed",
      startOffsetMs: 8,
      durationMs: 920,
    },
    {
      id: "for_each_pages",
      label: "For each page",
      blockType: "for_each",
      status: "completed",
      startOffsetMs: 930,
      durationMs: 3800,
      container: true,
      children: [
        {
          id: "extract_0",
          label: "Extract · page 1",
          blockType: "extract",
          status: "completed",
          startOffsetMs: 930,
          durationMs: 1800,
        },
        {
          id: "extract_1",
          label: "Extract · page 2",
          blockType: "extract",
          status: "completed",
          startOffsetMs: 2730,
          durationMs: 2000,
        },
      ],
    },
    {
      id: "merge",
      label: "Merge results",
      blockType: "merge_dicts",
      status: "completed",
      startOffsetMs: 4740,
      durationMs: 120,
    },
    {
      id: "route",
      label: "Route by amount",
      blockType: "conditional",
      status: "completed",
      startOffsetMs: 4870,
      durationMs: 4,
    },
    {
      id: "post",
      label: "Post to ERP",
      blockType: "api_call",
      status: "completed",
      startOffsetMs: 4880,
      durationMs: 1100,
    },
  ],
}

/**
 * Step waterfall block — a run's per-step timing as a horizontal waterfall,
 * preloaded with a sample run that includes a `for_each` container. Pass your own
 * {@link WaterfallRun} via the `run` prop.
 */
export function StepWaterfallBlock({ run = SAMPLE_RUN }: { run?: WaterfallRun }) {
  return (
    <div className="h-full min-h-[360px]">
      <StepWaterfall run={run} />
    </div>
  )
}
