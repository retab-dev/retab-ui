"use client"

import * as React from "react"
import { Check, Copy } from "lucide-react"

import { cn } from "@/lib/utils"
import { ScrollArea } from "@/components/ui/scroll-area"

/**
 * A small copy-to-clipboard button. Shows a transient check on success; style
 * placement via `className` (e.g. absolute-position it over a panel).
 */
export function CopyButton({
  text,
  className,
}: {
  text: string
  className?: string
}) {
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

/** Lightweight JSON syntax highlighting that respects the theme. */
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

/**
 * A read-only JSON viewer: pretty-prints `data`, applies theme-aware syntax
 * highlighting, scrolls within its container, and reveals a copy button on hover.
 */
export function JsonInspector({
  data,
  className,
}: {
  data: unknown
  className?: string
}) {
  const formatted = React.useMemo(() => JSON.stringify(data, null, 2), [data])

  return (
    <div className={cn("group relative h-full", className)}>
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
