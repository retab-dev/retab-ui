"use client"

import * as React from "react"

import { DocsViewCodeBlock } from "@/components/docs-code-block"
import {
  DocumentThumbnail,
  type DocumentKind,
} from "@/components/document-thumbnail"

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
  kind: DocumentKind
  src: string
  name: string
  type: string
}

const SAMPLES: FormatSample[] = [
  {
    label: "Image",
    kind: "image",
    src: "/samples/dashboard-preview.svg",
    name: "dashboard.png",
    type: "image/png",
  },
  {
    label: "PDF",
    kind: "pdf",
    src: "/samples/attention.pdf",
    name: "attention.pdf",
    type: "application/pdf",
  },
  {
    label: "DOCX",
    kind: "docx",
    src: "/samples/quarterly-business-review.docx",
    name: "quarterly-business-review.docx",
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  },
  {
    label: "PPTX",
    kind: "pptx",
    src: "/samples/sample-deck.pptx",
    name: "sample-deck.pptx",
    type: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  },
  {
    label: "XLSX",
    kind: "xlsx",
    src: "/samples/nvidia-financials-fy2024.xlsx",
    name: "nvidia-financials.xlsx",
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  },
  {
    label: "CSV",
    kind: "csv",
    src: "/samples/sales.csv",
    name: "sales.csv",
    type: "text/csv",
  },
  {
    label: "Markdown",
    kind: "markdown",
    src: "/samples/release-notes.md",
    name: "release-notes.md",
    type: "text/markdown",
  },
  {
    label: "HTML",
    kind: "html",
    src: "/samples/welcome.html",
    name: "welcome.html",
    type: "text/html",
  },
  {
    label: "JSON",
    kind: "text",
    src: "/samples/app-config.json",
    name: "app-config.json",
    type: "application/json",
  },
  {
    label: "Code",
    kind: "text",
    src: "/samples/use-debounced-value.ts",
    name: "use-debounced-value.ts",
    type: "text/plain",
  },
  {
    label: "Log",
    kind: "text",
    src: "/samples/server.log",
    name: "server.log",
    type: "text/plain",
  },
  {
    label: "TIFF",
    kind: "tiff",
    src: "/samples/nvidia-10q-scan.tiff",
    name: "nvidia-10q-scan.tiff",
    type: "image/tiff",
  },
]

export function FileThumbnailFormatsDemo() {
  return (
    <div
      data-slot="component-preview"
      className="group relative mt-4 mb-2 flex flex-col overflow-hidden rounded-xl border"
    >
      <div className="bg-background grid grid-cols-6 gap-3 p-6">
        {SAMPLES.map((sample) => (
          <div key={sample.label} className="space-y-1.5">
            <div className="truncate text-xs font-medium">{sample.label}</div>
            <DocumentThumbnail
              kind={sample.kind}
              src={sample.src}
              name={sample.name}
              type={sample.type}
              previewAspectRatio={1}
            />
          </div>
        ))}
      </div>
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
// kind: "pdf" | "docx" | "xlsx" | "pptx" | "image"
//     | "tiff" | "csv" | "markdown" | "html" | "text"

export function ImageThumbnail() {
  return (
    <DocumentThumbnail
      kind="image"
      src="/page.png"
      name="page.png"
      type="image/png"
      previewAspectRatio={1}
    />
  )
}

export function PdfThumbnail() {
  return (
    <DocumentThumbnail
      kind="pdf"
      src="/attention.pdf"
      name="attention.pdf"
      type="application/pdf"
      previewAspectRatio={1}
    />
  )
}

export function DocxThumbnail() {
  return (
    <DocumentThumbnail
      kind="docx"
      src="/quarterly-business-review.docx"
      name="quarterly-business-review.docx"
      type="application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      previewAspectRatio={1}
    />
  )
}

export function XlsxThumbnail() {
  return (
    <DocumentThumbnail
      kind="xlsx"
      src="/financials.xlsx"
      name="financials.xlsx"
      type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
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
