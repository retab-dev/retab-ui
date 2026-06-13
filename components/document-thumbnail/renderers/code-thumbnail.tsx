"use client"

import * as React from "react"

import type { ViewerResource } from "@/lib/viewer-resource"
import { extensionOf } from "@/lib/viewer-source"
import { useThumbnailResource } from "@/components/document-thumbnail/thumbnail-resource"
import {
  getThumbnailText,
  thumbnailFileMeta,
} from "@/components/document-thumbnail/thumbnail-text"

const CODE_THUMBNAIL_MAX_LINES = 60
const CODE_THUMBNAIL_FONT_SIZE = 5
const CODE_THUMBNAIL_LINE_HEIGHT = 1.5
const CODE_THUMBNAIL_LINE_NUMBER_WIDTH_CLASS = "w-2.5"

export function CodeThumbnail({
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
  const text = React.useMemo(
    () => formatCodeThumbnailText(raw, resource.fileName, resource.mimeType),
    [raw, resource.fileName, resource.mimeType]
  )
  const lines = React.useMemo(
    () =>
      text
        .replace(/\r?\n$/, "")
        .split(/\r\n?|\n/)
        .slice(0, CODE_THUMBNAIL_MAX_LINES),
    [text]
  )

  return (
    <div
      data-slot="code-thumbnail"
      className="absolute inset-0 overflow-hidden bg-card"
    >
      <div
        aria-hidden
        className={`absolute inset-y-0 left-0 ${CODE_THUMBNAIL_LINE_NUMBER_WIDTH_CLASS} bg-slate-50`}
      />
      <div
        className="relative font-mono"
        style={{
          fontSize: CODE_THUMBNAIL_FONT_SIZE,
          lineHeight: CODE_THUMBNAIL_LINE_HEIGHT,
        }}
      >
        {lines.map((line, i) => (
          <div key={i} className="flex">
            <span
              className={`${CODE_THUMBNAIL_LINE_NUMBER_WIDTH_CLASS} shrink-0 pr-px text-right text-slate-300 select-none`}
            >
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

function formatCodeThumbnailText(
  text: string,
  fileName: string,
  mimeType?: string
) {
  if (!isStrictJson(fileName, mimeType)) return text

  try {
    return JSON.stringify(JSON.parse(text), null, 2)
  } catch {
    return text
  }
}

function isStrictJson(fileName: string, mimeType?: string) {
  const extension = extensionOf(fileName)
  if (extension === "json") return true
  if (
    extension === "json5" ||
    extension === "jsonl" ||
    extension === "ndjson"
  ) {
    return false
  }

  const mime = mimeType?.toLowerCase().split(";")[0].trim()
  return mime === "application/json" || Boolean(mime?.endsWith("+json"))
}
