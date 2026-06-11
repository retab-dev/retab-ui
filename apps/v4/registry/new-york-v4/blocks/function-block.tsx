"use client"

import * as React from "react"
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Copy,
  Terminal,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

// ── Types ────────────────────────────────────────────────────────────────────

export type FunctionRun = {
  /** Whether the function executed without error. */
  isSuccess: boolean
  /** Optional one-line status message shown next to the badge. */
  message?: string
  /** Wall-clock execution time in milliseconds. */
  executionTimeMs?: number | null
  /** Input passed to the function. */
  inputData?: Record<string, unknown> | null
  /** Value the function returned. */
  outputData?: Record<string, unknown> | null
  /** Captured standard output. */
  stdout?: string | null
  /** Captured standard error. */
  stderr?: string | null
  /** Error message when the run failed. */
  error?: string | null
  /** Full traceback when the run failed. */
  traceback?: string | null
  /** The source that was executed (shown in the Code tab). */
  code?: string | null
  /** Language label for the Code tab, e.g. "python" or "typescript". */
  language?: string
}

// ── Small pieces ─────────────────────────────────────────────────────────────

function CopyButton({ text, className }: { text: string; className?: string }) {
  const [copied, setCopied] = React.useState(false)

  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard.writeText(text).then(() => {
          setCopied(true)
          window.setTimeout(() => setCopied(false), 1500)
        })
      }}
      className={cn(
        "rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
        className
      )}
      title="Copy"
    >
      {copied ? (
        <Check className="size-3.5 text-emerald-600 dark:text-emerald-400" />
      ) : (
        <Copy className="size-3.5" />
      )}
    </button>
  )
}

// Lightweight JSON syntax highlighting that respects the theme.
function colorizeJsonLine(line: string): React.ReactNode {
  const patterns: { regex: RegExp; className: string }[] = [
    { regex: /"([^"]+)"(?=\s*:)/g, className: "text-violet-600 dark:text-violet-400" },
    { regex: /"([^"]*)"/g, className: "text-amber-700 dark:text-amber-400" },
    { regex: /\b(true|false)\b/g, className: "text-emerald-600 dark:text-emerald-400" },
    { regex: /\bnull\b/g, className: "text-muted-foreground" },
    { regex: /\b(\d+\.?\d*)\b/g, className: "text-blue-600 dark:text-blue-400" },
  ]

  const spans: { start: number; end: number; className: string; text: string }[] =
    []

  for (const { regex, className } of patterns) {
    const re = new RegExp(regex.source, "g")
    let match: RegExpExecArray | null
    while ((match = re.exec(line)) !== null) {
      const start = match.index
      const end = start + match[0].length
      const overlaps = spans.some((s) => !(start >= s.end || end <= s.start))
      if (!overlaps) {
        spans.push({ start, end, className, text: match[0] })
      }
    }
  }

  if (spans.length === 0) {
    return <span className="text-foreground/70">{line}</span>
  }

  spans.sort((a, b) => a.start - b.start)
  const elements: React.ReactNode[] = []
  let lastEnd = 0
  for (const span of spans) {
    if (span.start > lastEnd) {
      elements.push(
        <span key={`t-${lastEnd}`} className="text-foreground/70">
          {line.slice(lastEnd, span.start)}
        </span>
      )
    }
    elements.push(
      <span key={`s-${span.start}`} className={span.className}>
        {span.text}
      </span>
    )
    lastEnd = span.end
  }
  if (lastEnd < line.length) {
    elements.push(
      <span key={`t-${lastEnd}`} className="text-foreground/70">
        {line.slice(lastEnd)}
      </span>
    )
  }
  return elements
}

function JsonViewer({ data }: { data: unknown }) {
  const formatted = React.useMemo(() => JSON.stringify(data, null, 2), [data])

  return (
    <div className="group relative h-full">
      <ScrollArea className="h-full">
        <pre className="p-3 font-mono text-xs leading-5">
          {formatted.split("\n").map((line, i) => (
            <div key={i}>{colorizeJsonLine(line)}</div>
          ))}
        </pre>
      </ScrollArea>
      <CopyButton
        text={formatted}
        className="absolute top-2 right-2 opacity-0 transition-opacity group-hover:opacity-100"
      />
    </div>
  )
}

function EmptyState({
  icon,
  children,
}: {
  icon: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-center text-muted-foreground">
      {icon}
      <span className="text-sm">{children}</span>
    </div>
  )
}

function ConsoleSection({
  label,
  content,
  variant = "default",
  defaultOpen = false,
}: {
  label: string
  content: string
  variant?: "default" | "warning"
  defaultOpen?: boolean
}) {
  const [isOpen, setIsOpen] = React.useState(defaultOpen)
  const lineCount = content.split("\n").length

  return (
    <div className="group relative border-b last:border-b-0">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        className={cn(
          "flex w-full items-center gap-1.5 px-3 py-2 text-left text-xs font-medium transition-colors",
          variant === "warning"
            ? "text-amber-700 hover:text-amber-900 dark:text-amber-400 dark:hover:text-amber-300"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        {isOpen ? (
          <ChevronDown className="size-3" />
        ) : (
          <ChevronRight className="size-3" />
        )}
        {label}
        <span className="font-normal text-muted-foreground/70">
          ({lineCount} line{lineCount !== 1 ? "s" : ""})
        </span>
      </button>
      {isOpen && (
        <>
          <pre
            className={cn(
              "px-3 pb-3 font-mono text-xs leading-5 break-all whitespace-pre-wrap",
              variant === "warning"
                ? "text-amber-800 dark:text-amber-300"
                : "text-foreground/80"
            )}
          >
            {content}
          </pre>
          <CopyButton
            text={content}
            className="absolute top-1.5 right-2 opacity-0 transition-opacity group-hover:opacity-100"
          />
        </>
      )}
    </div>
  )
}

function CodeView({ code }: { code: string }) {
  return (
    <div className="group relative h-full">
      <ScrollArea className="h-full">
        <pre className="p-3 font-mono text-xs leading-5 text-foreground/80">
          {code}
        </pre>
      </ScrollArea>
      <CopyButton
        text={code}
        className="absolute top-2 right-2 opacity-0 transition-opacity group-hover:opacity-100"
      />
    </div>
  )
}

// ── Inspector ────────────────────────────────────────────────────────────────

/**
 * Inspect a single function execution — a success/error badge and duration up
 * top, then tabs for the Input it received, the Output it returned, the Console
 * (stdout / stderr / traceback) and the Code that ran. Pass a {@link FunctionRun};
 * everything below is presentation only.
 */
export function FunctionInspector({ run }: { run: FunctionRun }) {
  const {
    isSuccess,
    message,
    executionTimeMs,
    inputData,
    outputData,
    stdout,
    stderr,
    error,
    traceback,
    code,
    language = "python",
  } = run

  const hasConsole = !!stdout || !!stderr || !!traceback || !!error

  const tabs = [
    ...(inputData ? [{ value: "input", label: "Input" }] : []),
    { value: "output", label: "Output" },
    { value: "console", label: "Console" },
    ...(code ? [{ value: "code", label: "Code" }] : []),
  ]

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-background">
      {/* Status bar */}
      <div className="flex items-center gap-3 border-b bg-muted/40 px-4 py-3">
        <span
          className={cn(
            "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
            isSuccess
              ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-400"
              : "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-400"
          )}
        >
          {isSuccess ? (
            <CheckCircle2 className="size-3" />
          ) : (
            <AlertTriangle className="size-3" />
          )}
          {isSuccess ? "Success" : "Error"}
        </span>
        {message && (
          <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
            {message}
          </span>
        )}
        {executionTimeMs != null && (
          <span className="ml-auto flex flex-shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="size-3.5" />
            <span className="font-mono">
              {executionTimeMs >= 1000
                ? `${(executionTimeMs / 1000).toFixed(2)} s`
                : `${executionTimeMs.toFixed(0)} ms`}
            </span>
          </span>
        )}
      </div>

      {/* Tabbed content */}
      <Tabs
        defaultValue={!isSuccess && !outputData ? "console" : "output"}
        className="flex min-h-0 flex-1 flex-col gap-0 overflow-hidden"
      >
        <TabsList
          variant="underline"
          className="w-full flex-shrink-0 justify-start rounded-none border-b bg-transparent px-2"
        >
          {tabs.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value} className="text-xs">
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {inputData && (
          <TabsContent value="input" className="m-0 min-h-0 flex-1 overflow-hidden">
            <JsonViewer data={inputData} />
          </TabsContent>
        )}

        <TabsContent value="output" className="m-0 min-h-0 flex-1 overflow-hidden">
          {outputData ? (
            <JsonViewer data={outputData} />
          ) : (
            <EmptyState
              icon={
                <AlertTriangle className="size-6 text-red-400 dark:text-red-500" />
              }
            >
              {isSuccess
                ? "No output data"
                : "Function failed — no output produced. Check the Console tab."}
            </EmptyState>
          )}
        </TabsContent>

        <TabsContent value="console" className="m-0 min-h-0 flex-1 overflow-hidden">
          {hasConsole ? (
            <ScrollArea className="h-full">
              {error && (
                <div className="flex items-start gap-2 border-b border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-400">
                  <AlertTriangle className="mt-0.5 size-3.5 flex-shrink-0" />
                  <span className="break-all">{error}</span>
                </div>
              )}
              {traceback && (
                <ConsoleSection
                  label="Traceback"
                  content={traceback}
                  variant="warning"
                  defaultOpen
                />
              )}
              {stdout && (
                <ConsoleSection label="stdout" content={stdout} defaultOpen />
              )}
              {stderr && (
                <ConsoleSection
                  label="stderr"
                  content={stderr}
                  variant="warning"
                />
              )}
            </ScrollArea>
          ) : (
            <EmptyState
              icon={<Terminal className="size-6 text-muted-foreground/60" />}
            >
              No console output
            </EmptyState>
          )}
        </TabsContent>

        {code && (
          <TabsContent value="code" className="m-0 min-h-0 flex-1 overflow-hidden">
            <CodeView code={code} />
            <span className="sr-only">{language}</span>
          </TabsContent>
        )}
      </Tabs>
    </div>
  )
}

// ── Block (self-contained demo with sample data) ─────────────────────────────

const SAMPLE_CODE = `from pydantic import BaseModel


class Output(BaseModel):
    invoice_number: str
    subtotal: float
    tax: float
    total: float
    currency: str


def transform(input: Input) -> Output:
    rate = 0.085  # 8.5% sales tax
    subtotal = input.amount
    tax = round(subtotal * rate, 2)
    total = round(subtotal + tax, 2)
    print(f"Computed tax {tax} on subtotal {subtotal}")
    return Output(
        invoice_number=input.invoice_number,
        subtotal=subtotal,
        tax=tax,
        total=total,
        currency=input.currency,
    )
`

const SAMPLE_RUN: FunctionRun = {
  isSuccess: true,
  message: "Returned Output",
  executionTimeMs: 214,
  language: "python",
  inputData: {
    invoice_number: "INV-8842",
    amount: 12480.5,
    currency: "USD",
  },
  outputData: {
    invoice_number: "INV-8842",
    subtotal: 12480.5,
    tax: 1060.84,
    total: 13541.34,
    currency: "USD",
  },
  stdout: "Computed tax 1060.84 on subtotal 12480.5",
  stderr: null,
  error: null,
  traceback: null,
  code: SAMPLE_CODE,
}

/**
 * Function block — an inspector for a single function execution, preloaded with
 * a sample Python transform. Pass your own {@link FunctionRun} via the `run` prop
 * to inspect a real execution.
 */
export function FunctionBlock({ run = SAMPLE_RUN }: { run?: FunctionRun }) {
  return (
    <div className="flex h-full min-h-[420px]">
      <FunctionInspector run={run} />
    </div>
  )
}
