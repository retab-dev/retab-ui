"use client"

import * as React from "react"
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  Check,
  ChevronDown,
  ChevronRight,
  Clock,
  Copy,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

// ── Types ────────────────────────────────────────────────────────────────────

export type ApiCall = {
  url: string
  method: string
  requestHeaders?: Record<string, string>
  requestBody?: unknown
  responseStatusCode?: number | null
  responseBody?: string | null
  responseHeaders?: Record<string, string> | null
  durationMs?: number | null
  error?: string | null
}

// ── Status helpers ───────────────────────────────────────────────────────────

type StatusInfo = { className: string; label: string }

function getStatusInfo(
  statusCode: number | null | undefined,
  error: string | null | undefined
): StatusInfo {
  if (error) {
    return {
      className:
        "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-900",
      label: "Error",
    }
  }
  if (statusCode == null) {
    return {
      className:
        "bg-muted text-muted-foreground border-border",
      label: "No Response",
    }
  }
  if (statusCode >= 200 && statusCode < 300) {
    return {
      className:
        "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900",
      label: "OK",
    }
  }
  if (statusCode >= 300 && statusCode < 400) {
    return {
      className:
        "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-900",
      label: "Redirect",
    }
  }
  if (statusCode >= 400 && statusCode < 500) {
    return {
      className:
        "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900",
      label: "Client Error",
    }
  }
  return {
    className:
      "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-900",
    label: "Server Error",
  }
}

const METHOD_COLORS: Record<string, string> = {
  GET: "bg-emerald-600",
  POST: "bg-blue-600",
  PUT: "bg-amber-600",
  PATCH: "bg-purple-600",
  DELETE: "bg-red-600",
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

function HeadersSection({ headers }: { headers: Record<string, string> }) {
  const [isOpen, setIsOpen] = React.useState(true)
  const entries = Object.entries(headers)

  if (entries.length === 0) {
    return (
      <div className="px-3 py-2 text-xs text-muted-foreground italic">
        No headers
      </div>
    )
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        className="flex w-full items-center gap-1.5 px-3 py-2 text-left text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        {isOpen ? (
          <ChevronDown className="size-3" />
        ) : (
          <ChevronRight className="size-3" />
        )}
        {entries.length} header{entries.length !== 1 ? "s" : ""}
      </button>
      {isOpen && (
        <div className="space-y-1 px-3 pb-3">
          {entries.map(([key, value]) => (
            <div key={key} className="font-mono text-xs break-all">
              <span className="text-violet-600 dark:text-violet-400">
                {key}
              </span>
              <span className="text-muted-foreground">: </span>
              <span className="text-foreground/80">{value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
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

function BodyPanel({ body }: { body: unknown }) {
  if (body == null || body === "") {
    return (
      <div className="flex h-full items-center justify-center p-4 text-center text-sm text-muted-foreground">
        No body
      </div>
    )
  }
  if (typeof body === "object") {
    return <JsonViewer data={body} />
  }
  return (
    <div className="group relative h-full">
      <ScrollArea className="h-full">
        <pre className="p-3 font-mono text-xs whitespace-pre-wrap text-foreground/80">
          {String(body)}
        </pre>
      </ScrollArea>
      <CopyButton
        text={String(body)}
        className="absolute top-2 right-2 opacity-0 transition-opacity group-hover:opacity-100"
      />
    </div>
  )
}

function ExchangePanel({
  side,
  body,
  headers,
}: {
  side: "request" | "response"
  body: unknown
  headers: Record<string, string>
}) {
  const isRequest = side === "request"
  return (
    <div className="flex min-h-0 flex-col overflow-hidden">
      <div className="flex items-center gap-2 border-b bg-muted/40 px-4 py-2.5">
        {isRequest ? (
          <ArrowUpRight className="size-4 text-violet-600 dark:text-violet-400" />
        ) : (
          <ArrowDownLeft className="size-4 text-emerald-600 dark:text-emerald-400" />
        )}
        <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
          {side}
        </span>
      </div>
      <Tabs
        defaultValue="body"
        className="flex min-h-0 flex-1 flex-col gap-0 overflow-hidden"
      >
        <TabsList
          variant="underline"
          className="w-full flex-shrink-0 justify-start rounded-none border-b bg-transparent px-2"
        >
          <TabsTrigger value="body" className="text-xs">
            Body
          </TabsTrigger>
          <TabsTrigger value="headers" className="text-xs">
            Headers
          </TabsTrigger>
        </TabsList>
        <TabsContent value="body" className="m-0 min-h-0 flex-1 overflow-hidden">
          <BodyPanel body={body} />
        </TabsContent>
        <TabsContent
          value="headers"
          className="m-0 min-h-0 flex-1 overflow-hidden"
        >
          <ScrollArea className="h-full">
            <HeadersSection headers={headers} />
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  )
}

// ── Inspector ────────────────────────────────────────────────────────────────

/**
 * Inspect a single HTTP exchange — method, URL and status up top, request and
 * response side by side below, each with a Body / Headers tab. Pass an
 * {@link ApiCall} describing the call; everything below is presentation only.
 */
export function ApiCallInspector({ call }: { call: ApiCall }) {
  const {
    url,
    method,
    requestHeaders = {},
    requestBody,
    responseStatusCode,
    responseBody,
    responseHeaders,
    durationMs,
    error,
  } = call

  const status = getStatusInfo(responseStatusCode, error)

  const parsedResponseBody = React.useMemo(() => {
    if (responseBody == null) return null
    try {
      return JSON.parse(responseBody)
    } catch {
      return responseBody
    }
  }, [responseBody])

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-background">
      {/* Top bar */}
      <div className="flex flex-wrap items-center gap-3 border-b bg-muted/40 px-4 py-3">
        <span
          className={cn(
            "rounded-md px-2.5 py-1 text-xs font-semibold tracking-wide text-white",
            METHOD_COLORS[method] ?? "bg-muted-foreground"
          )}
        >
          {method}
        </span>
        <div className="flex min-w-0 flex-1 items-center gap-1">
          <span className="truncate font-mono text-xs text-foreground/80" title={url}>
            {url}
          </span>
          <CopyButton text={url} />
        </div>
        <span
          className={cn(
            "flex items-center gap-2 rounded-full border px-3 py-1 font-mono text-sm font-bold",
            status.className
          )}
        >
          {responseStatusCode != null && <span>{responseStatusCode}</span>}
          <span className="text-xs font-normal opacity-75">{status.label}</span>
        </span>
        {durationMs != null && (
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="size-3.5" />
            <span className="font-mono">{durationMs.toFixed(0)} ms</span>
          </span>
        )}
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-3 border-b border-red-200 bg-red-50 px-4 py-3 dark:border-red-900 dark:bg-red-950/40">
          <AlertTriangle className="size-4 flex-shrink-0 text-red-600 dark:text-red-400" />
          <span className="text-sm text-red-700 dark:text-red-400">{error}</span>
        </div>
      )}

      {/* Request | Response */}
      <div className="grid min-h-0 flex-1 grid-cols-2 divide-x overflow-hidden">
        <ExchangePanel
          side="request"
          body={requestBody}
          headers={requestHeaders}
        />
        <ExchangePanel
          side="response"
          body={parsedResponseBody}
          headers={responseHeaders ?? {}}
        />
      </div>
    </div>
  )
}

// ── Block (self-contained demo with sample data) ─────────────────────────────

const SAMPLE_CALL: ApiCall = {
  url: "https://api.retab.com/v1/documents/extract",
  method: "POST",
  requestHeaders: {
    "Content-Type": "application/json",
    Authorization: "Bearer sk_live_••••••••••••8f3a",
    "Idempotency-Key": "idem_4b1c9e2a",
    "User-Agent": "retab-python/0.42.0",
  },
  requestBody: {
    model: "retab-large",
    modality: "native",
    document: { url: "https://files.retab.com/uploads/invoice_8842.pdf" },
    json_schema: {
      type: "object",
      properties: {
        invoice_number: { type: "string" },
        total_amount: { type: "number" },
        currency: { type: "string" },
        due_date: { type: "string", format: "date" },
      },
      required: ["invoice_number", "total_amount"],
    },
  },
  responseStatusCode: 200,
  durationMs: 1842,
  responseHeaders: {
    "Content-Type": "application/json",
    "x-request-id": "req_9f2b7c41a8",
    "x-ratelimit-remaining": "4998",
  },
  responseBody: JSON.stringify({
    id: "extr_2Kd9aZ",
    object: "document.extraction",
    model: "retab-large",
    output: {
      invoice_number: "INV-8842",
      total_amount: 12480.5,
      currency: "USD",
      due_date: "2026-07-15",
    },
    usage: { page_count: 3, credits: 3 },
  }),
}

/**
 * API Call block — a request/response inspector for a single HTTP exchange,
 * preloaded with a sample Retab extraction call. Drop in your own {@link ApiCall}
 * via the `call` prop to inspect a real exchange.
 */
export function ApiCallBlock({ call = SAMPLE_CALL }: { call?: ApiCall }) {
  return (
    <div className="flex h-full min-h-[420px]">
      <ApiCallInspector call={call} />
    </div>
  )
}
