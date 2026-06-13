"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import type { FileCategory } from "@/lib/viewer-source"
import { DocsViewCodeBlock } from "@/components/docs-code-block"
import { DocumentThumbnail } from "@/components/document-thumbnail"

/**
 * The hero showcase: one bordered card with a large, labeled, *square* preview
 * per format plus an inline "View Code" panel — the same shape as the rest of
 * the component docs. Each preview is rendered to its first unit only (page 1,
 * first sheet) by `DocumentThumbnail`, then dropped into the dependency-free
 * `FileThumbnail` shell, which handles the loading shimmer, fade-in, and
 * fallback. Forcing a square aspect ratio keeps every tile the same size.
 */

interface FormatSample {
  label: string
  url: string
  fileName: string
  mimeType: string
  as?: FileCategory
}

const SAMPLES: FormatSample[] = [
  {
    label: "Image",
    url: "/samples/dashboard-preview.svg",
    fileName: "dashboard.png",
    mimeType: "image/png",
  },
  {
    label: "PDF",
    url: "/samples/an-image-is-worth-16x16-words.pdf",
    fileName: "an-image-is-worth-16x16-words.pdf",
    mimeType: "application/pdf",
  },
  {
    label: "DOCX",
    url: "/samples/quarterly-business-review.docx",
    fileName: "quarterly-business-review.docx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  },
  {
    label: "PPTX",
    url: "/samples/sample-deck.pptx",
    fileName: "sample-deck.pptx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  },
  {
    label: "XLSX",
    url: "/samples/nvidia-financials-fy2024.xlsx",
    fileName: "nvidia-financials.xlsx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  },
  {
    label: "CSV",
    url: "/samples/sales.csv",
    fileName: "sales.csv",
    mimeType: "text/csv",
  },
  {
    label: "Markdown",
    url: "/samples/release-notes.md",
    fileName: "release-notes.md",
    mimeType: "text/markdown",
  },
  {
    label: "HTML",
    url: "/samples/welcome.html",
    fileName: "welcome.html",
    mimeType: "text/html",
  },
  {
    label: "JSON",
    url: "/samples/app-config.json",
    fileName: "app-config.json",
    mimeType: "application/json",
  },
  {
    label: "Code",
    url: "/samples/use-debounced-value.ts",
    fileName: "use-debounced-value.ts",
    mimeType: "text/plain",
  },
  {
    label: "Text",
    url: "/samples/review-notes.txt",
    fileName: "review-notes.txt",
    mimeType: "text/plain",
  },
  {
    label: "TIFF",
    url: "/samples/entropy.tiff",
    fileName: "entropy.tiff",
    mimeType: "image/tiff",
  },
]

/** The bare grid of real, labeled format previews — 3 rows of 4 (grid-cols-4).
 *  Reused by the docs demo (below) and the home showcase. */
export function FileThumbnailFormatsGrid({
  className,
}: {
  className?: string
}) {
  return (
    <div className={cn("grid grid-cols-4 gap-3 bg-background p-6", className)}>
      {SAMPLES.map((sample) => (
        <div key={sample.label} className="space-y-1.5">
          <div className="truncate text-xs font-medium">{sample.label}</div>
          <DocumentThumbnail
            source={{
              kind: "url",
              url: sample.url,
              fileName: sample.fileName,
              mimeType: sample.mimeType,
            }}
            as={sample.as}
            previewAspectRatio={1}
          />
        </div>
      ))}
    </div>
  )
}

export function FileThumbnailFormatsDemo() {
  return (
    <div
      data-slot="component-preview"
      className="group relative mt-4 mb-2 flex flex-col overflow-hidden rounded-xl border"
    >
      <FileThumbnailFormatsGrid />
      <DocsViewCodeBlock code={formatsDemoCode} />
    </div>
  )
}

const formatsDemoCode = `"use client"

import { DocumentThumbnail } from "@/components/document-thumbnail"
import { FileThumbnail } from "@/components/ui/file-thumbnail"

// DocumentThumbnail renders the first unit — page 1, first sheet, first slide,
// first TIFF frame, or the head of a text/markdown/html/csv file — using the
// standard libraries (pdfjs-dist, @e965/xlsx, pptxviewjs, docx-preview, utif,
// marked) and drops it into the FileThumbnail shell. Pass previewAspectRatio={1}
// for uniform square tiles.
//
export function ImageThumbnail() {
  return (
    <DocumentThumbnail
      source={{
        kind: "url",
        url: "/page.png",
        fileName: "page.png",
        mimeType: "image/png",
      }}
      previewAspectRatio={1}
    />
  )
}

export function PdfThumbnail() {
  return (
    <DocumentThumbnail
      source={{
        kind: "url",
        url: "/an-image-is-worth-16x16-words.pdf",
        fileName: "an-image-is-worth-16x16-words.pdf",
        mimeType: "application/pdf",
      }}
      previewAspectRatio={1}
    />
  )
}

export function DocxThumbnail() {
  return (
    <DocumentThumbnail
      source={{
        kind: "url",
        url: "/quarterly-business-review.docx",
        fileName: "quarterly-business-review.docx",
        mimeType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      }}
      previewAspectRatio={1}
    />
  )
}

export function XlsxThumbnail() {
  return (
    <DocumentThumbnail
      source={{
        kind: "url",
        url: "/financials.xlsx",
        fileName: "financials.xlsx",
        mimeType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }}
      previewAspectRatio={1}
    />
  )
}

// FileThumbnail on its own is just the shell — feed it any externally
// generated thumbnail through previewImageUrl or previewContent.
export function ExternalThumbnail({ url }: { url: string }) {
  return (
    <FileThumbnail
      file={{ name: "contract.pdf", type: "application/pdf" }}
      previewAspectRatio={1}
      previewImageUrl={url}
    />
  )
}`
