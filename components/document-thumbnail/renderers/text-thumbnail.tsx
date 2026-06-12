"use client"

import * as React from "react"

import type { ViewerResource } from "@/lib/viewer-resource"
import {
  getThumbnailText,
  thumbnailFileMeta,
  useThumbnailResource,
} from "@/components/document-thumbnail/cache"

export function TextFirstLines({
  resource,
  thumbnailKey,
}: {
  resource: ViewerResource
  thumbnailKey: string
}) {
  const raw = useThumbnailResource(
    getThumbnailText(
      thumbnailFileMeta(resource),
      resource.content,
      thumbnailKey
    )
  )
  const text = React.useMemo(() => {
    if (/\.(json|json5|ndjson|jsonl)$/i.test(resource.fileName)) {
      try {
        return JSON.stringify(JSON.parse(raw), null, 2)
      } catch {
        /* not strict JSON — show as-is */
      }
    }
    return raw
  }, [raw, resource.fileName])

  const lines = React.useMemo(
    () => text.replace(/\n$/, "").split("\n").slice(0, 60),
    [text]
  )

  return (
    <div className="absolute inset-0 overflow-hidden bg-card">
      <div
        aria-hidden
        className="absolute inset-y-0 left-0 w-2.5 bg-slate-50"
      />
      <div
        className="relative font-mono"
        style={{ fontSize: 5, lineHeight: 1.5 }}
      >
        {lines.map((line, i) => (
          <div key={i} className="flex">
            <span className="w-2.5 shrink-0 pr-px text-right text-slate-300 select-none">
              {i + 1}
            </span>
            <span className="pl-0.5 whitespace-pre text-foreground/80">
              {line || " "}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
