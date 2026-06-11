"use client"

import * as React from "react"

import { getText } from "@/components/document-thumbnail/cache"

export function TextFirstLines({
  src,
  resourceKey,
}: {
  src: string
  resourceKey: string
}) {
  const raw = React.use(getText(src, resourceKey))
  const text = React.useMemo(() => {
    if (/\.(json|json5|ndjson|jsonl)$/i.test(src)) {
      try {
        return JSON.stringify(JSON.parse(raw), null, 2)
      } catch {
        /* not strict JSON — show as-is */
      }
    }
    return raw
  }, [raw, src])

  const lines = React.useMemo(
    () => text.replace(/\n$/, "").split("\n").slice(0, 60),
    [text]
  )

  return (
    <div className="bg-card absolute inset-0 overflow-hidden">
      <div aria-hidden className="absolute inset-y-0 left-0 w-2.5 bg-slate-50" />
      <div className="relative font-mono" style={{ fontSize: 5, lineHeight: 1.5 }}>
        {lines.map((line, i) => (
          <div key={i} className="flex">
            <span className="w-2.5 shrink-0 pr-px text-right text-slate-300 select-none">
              {i + 1}
            </span>
            <span className="text-foreground/80 whitespace-pre pl-0.5">
              {line || " "}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
