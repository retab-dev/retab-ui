"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import { ScrollArea } from "@/components/ui/scroll-area"

// ── Types ────────────────────────────────────────────────────────────────────

/** A single comparison within a branch, e.g. `total_amount > 10000`. */
export type SubConditionEval = {
  /** Field path the value was read from, e.g. `data.total_amount`. */
  path: string
  /** Comparison operator key, e.g. `is_greater_than`, `is_equal_to`, `contains`. */
  operator: string
  /** The value the condition compared against. */
  expected?: unknown
  /** The value found in the input. */
  actual?: unknown
  /** Whether this comparison held. */
  matched: boolean
}

/** One branch of the if/else: an `if`, an `else if`, or the terminal `else`. */
export type BranchEval = {
  id: string
  kind: "if" | "else_if" | "else"
  /** How sub-conditions combine. Ignored for `else`. */
  logicalOperator?: "and" | "or"
  /** The comparisons in this branch. Empty/omitted for `else`. */
  subConditions?: SubConditionEval[]
  /** Whether the branch evaluated to true. */
  matched: boolean
  /** True when the branch was not evaluated because an earlier branch matched. */
  skipped?: boolean
}

export type ConditionalRun = {
  branches: BranchEval[]
  /** The branch that was ultimately taken. */
  selectedBranchId?: string | null
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const OPERATOR_LABELS: Record<string, string> = {
  is_equal_to: "=",
  is_not_equal_to: "≠",
  is_greater_than: ">",
  is_less_than: "<",
  is_greater_than_or_equal_to: "≥",
  is_less_than_or_equal_to: "≤",
  contains: "contains",
  does_not_contain: "does not contain",
  starts_with: "starts with",
  ends_with: "ends with",
  matches_regex: "matches",
  exists: "exists",
  does_not_exist: "does not exist",
  is_empty: "is empty",
  is_not_empty: "is not empty",
  is_true: "is true",
  is_false: "is false",
  is_similar_to: "is similar to",
}

function formatOperator(operator: string): string {
  return OPERATOR_LABELS[operator] ?? operator.replace(/_/g, " ")
}

/** Operators that read as complete clauses and need no expected value shown. */
const UNARY_OPERATORS = new Set([
  "exists",
  "does_not_exist",
  "is_empty",
  "is_not_empty",
  "is_true",
  "is_false",
])

function stripDataPrefix(path: string): string {
  return path.replace(/^(data|likelihoods)\./, "")
}

function stringifyCompact(value: unknown, maxLen = 80): string {
  if (value === undefined) return "—"
  let out: string
  if (typeof value === "string") {
    out = JSON.stringify(value)
  } else {
    try {
      out = JSON.stringify(value)
    } catch {
      out = String(value)
    }
  }
  return out.length > maxLen ? `${out.slice(0, maxLen - 1)}…` : out
}

const BRANCH_LABELS: Record<BranchEval["kind"], string> = {
  if: "IF",
  else_if: "ELSE IF",
  else: "ELSE",
}

const BRANCH_BADGE: Record<BranchEval["kind"], string> = {
  if: "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400",
  else_if: "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400",
  else: "bg-muted text-muted-foreground",
}

// ── Small pieces ─────────────────────────────────────────────────────────────

function BranchBadge({ kind }: { kind: BranchEval["kind"] }) {
  return (
    <span
      className={cn(
        "inline-flex rounded px-1.5 py-0.5 font-mono text-[10px] font-bold tracking-wide",
        BRANCH_BADGE[kind]
      )}
    >
      {BRANCH_LABELS[kind]}
    </span>
  )
}

function ResultPill({ value }: { value: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2 py-0.5 font-mono text-[10px] font-bold",
        value
          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400"
          : "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400"
      )}
    >
      {value ? "true" : "false"}
    </span>
  )
}

function Verdict({ branch }: { branch: BranchEval }) {
  if (branch.skipped) {
    return (
      <span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
        Skipped
      </span>
    )
  }
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold",
        branch.matched
          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400"
          : "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400"
      )}
    >
      {branch.matched ? "Matched" : "Not matched"}
    </span>
  )
}

function LogicalChip({ operator }: { operator: "and" | "or" }) {
  return (
    <span
      className={cn(
        "mx-0.5 inline-flex rounded px-1 py-0.5 font-mono text-[9px] font-bold tracking-wider uppercase",
        operator === "and"
          ? "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400"
          : "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400"
      )}
    >
      {operator}
    </span>
  )
}

/** Inline formula: `field op value AND field op value`, colored by outcome. */
function Formula({ branch }: { branch: BranchEval }) {
  const subs = branch.subConditions ?? []
  if (subs.length === 0) {
    return <span className="text-muted-foreground italic">otherwise</span>
  }
  const operator = branch.logicalOperator ?? "and"
  return (
    <span className="font-mono text-[11px]">
      {subs.map((sub, i) => (
        <React.Fragment key={i}>
          {i > 0 && <LogicalChip operator={operator} />}
          <span
            className={cn(
              branch.skipped
                ? "text-muted-foreground"
                : sub.matched
                  ? "text-emerald-700 dark:text-emerald-400"
                  : "text-red-700 dark:text-red-400"
            )}
          >
            {stripDataPrefix(sub.path)} {formatOperator(sub.operator)}
            {UNARY_OPERATORS.has(sub.operator)
              ? ""
              : ` ${stringifyCompact(sub.expected, 24)}`}
          </span>
        </React.Fragment>
      ))}
    </span>
  )
}

// ── Breakdown table ──────────────────────────────────────────────────────────

const TH =
  "px-3 py-2 text-left text-[10px] font-semibold tracking-wider text-muted-foreground uppercase"
const TD = "px-3 py-2 align-top"

/**
 * Render how an if/else block evaluated: a summary of every branch and its
 * verdict up top, then a per-branch breakdown of each comparison — the field,
 * operator, expected and actual values, and whether it held. The branch that was
 * taken is highlighted. Pass a {@link ConditionalRun}; presentation only.
 */
export function ConditionalBreakdownTable({ run }: { run: ConditionalRun }) {
  const { branches, selectedBranchId } = run
  const detailed = branches.filter(
    (b) => !b.skipped && (b.subConditions?.length ?? 0) > 0
  )

  return (
    <ScrollArea className="h-full w-full">
      <div className="flex flex-col gap-5 p-4">
        {/* Summary */}
        <section className="flex flex-col gap-2">
          <h3 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
            Branches
          </h3>
          <div className="overflow-hidden rounded-lg border">
            <table className="w-full border-collapse text-sm">
              <thead className="border-b bg-muted/40">
                <tr>
                  <th className={cn(TH, "w-24")}>Branch</th>
                  <th className={TH}>Condition</th>
                  <th className={cn(TH, "w-28")}>Verdict</th>
                </tr>
              </thead>
              <tbody>
                {branches.map((branch) => {
                  const selected = branch.id === selectedBranchId
                  return (
                    <tr
                      key={branch.id}
                      className={cn(
                        "border-b last:border-b-0",
                        selected && "bg-emerald-50/60 dark:bg-emerald-950/20",
                        branch.skipped && "opacity-60"
                      )}
                    >
                      <td className={TD}>
                        <div className="flex items-center gap-1.5">
                          <BranchBadge kind={branch.kind} />
                          {selected && (
                            <span className="inline-flex rounded-full bg-emerald-600 px-1.5 py-0.5 text-[9px] font-bold tracking-wide text-white uppercase">
                              Taken
                            </span>
                          )}
                        </div>
                      </td>
                      <td className={cn(TD, "min-w-0")}>
                        <Formula branch={branch} />
                      </td>
                      <td className={TD}>
                        <Verdict branch={branch} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* Per-branch breakdown */}
        {detailed.map((branch) => (
          <section key={branch.id} className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <BranchBadge kind={branch.kind} />
              <h3 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                Breakdown
              </h3>
              {branch.id === selectedBranchId && (
                <span className="inline-flex rounded-full bg-emerald-600 px-1.5 py-0.5 text-[9px] font-bold tracking-wide text-white uppercase">
                  Taken
                </span>
              )}
              {(branch.subConditions?.length ?? 0) > 1 && (
                <span className="text-[10px] text-muted-foreground">
                  combined with{" "}
                  <span className="font-mono font-semibold uppercase">
                    {branch.logicalOperator ?? "and"}
                  </span>
                </span>
              )}
            </div>
            <div className="overflow-hidden rounded-lg border">
              <table className="w-full border-collapse text-sm">
                <thead className="border-b bg-muted/40">
                  <tr>
                    <th className={TH}>Field</th>
                    <th className={cn(TH, "w-32")}>Operator</th>
                    <th className={TH}>Expected</th>
                    <th className={TH}>Actual</th>
                    <th className={cn(TH, "w-20")}>Result</th>
                  </tr>
                </thead>
                <tbody>
                  {(branch.subConditions ?? []).map((sub, i) => (
                    <tr key={i} className="border-b last:border-b-0">
                      <td className={cn(TD, "font-mono text-[11px] text-foreground/80")}>
                        {stripDataPrefix(sub.path)}
                      </td>
                      <td className={cn(TD, "font-mono text-[11px] text-muted-foreground")}>
                        {formatOperator(sub.operator)}
                      </td>
                      <td className={cn(TD, "font-mono text-[11px] text-amber-700 dark:text-amber-400")}>
                        {UNARY_OPERATORS.has(sub.operator)
                          ? "—"
                          : stringifyCompact(sub.expected)}
                      </td>
                      <td className={cn(TD, "font-mono text-[11px] text-blue-700 dark:text-blue-400")}>
                        {stringifyCompact(sub.actual)}
                      </td>
                      <td className={TD}>
                        <ResultPill value={sub.matched} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))}
      </div>
    </ScrollArea>
  )
}

// ── Block (self-contained demo with sample data) ─────────────────────────────

const SAMPLE_RUN: ConditionalRun = {
  selectedBranchId: "else_if_0",
  branches: [
    {
      id: "if",
      kind: "if",
      logicalOperator: "and",
      matched: false,
      subConditions: [
        {
          path: "data.total_amount",
          operator: "is_greater_than",
          expected: 50000,
          actual: 13541.34,
          matched: false,
        },
        {
          path: "data.currency",
          operator: "is_equal_to",
          expected: "USD",
          actual: "USD",
          matched: true,
        },
      ],
    },
    {
      id: "else_if_0",
      kind: "else_if",
      logicalOperator: "and",
      matched: true,
      subConditions: [
        {
          path: "data.total_amount",
          operator: "is_greater_than",
          expected: 10000,
          actual: 13541.34,
          matched: true,
        },
        {
          path: "data.status",
          operator: "is_equal_to",
          expected: "approved",
          actual: "approved",
          matched: true,
        },
      ],
    },
    {
      id: "else",
      kind: "else",
      matched: true,
      skipped: true,
    },
  ],
}

/**
 * If / Else block — a breakdown table for a conditional routing step, preloaded
 * with a sample evaluation. Pass your own {@link ConditionalRun} via the `run`
 * prop to inspect a real evaluation.
 */
export function ConditionalBlock({ run = SAMPLE_RUN }: { run?: ConditionalRun }) {
  return (
    <div className="h-full min-h-[420px] bg-background">
      <ConditionalBreakdownTable run={run} />
    </div>
  )
}
