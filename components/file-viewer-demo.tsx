"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import { FileViewer } from "@/components/ui/file-viewer"

const FILES = [
  { label: "PDF", file: "big-911-report.pdf" },
  { label: "Image", file: "attention-page-1.png" },
  { label: "TIFF", file: "nvidia-10q-scan.tiff" },
  { label: "XLSX", file: "nvidia-financials-fy2024.xlsx" },
  { label: "PPTX", file: "sample-presentation.pptx" },
  { label: "DOCX", file: "quarterly-business-review.docx" },
  { label: "CSV", file: "sales.csv" },
  { label: "Markdown", file: "release-notes.md" },
  { label: "HTML", file: "welcome.html" },
  { label: "JSON", file: "app-config.json" },
  { label: "Text", file: "server.log" },
]

function FileTabs({
  active,
  onChange,
  className,
}: {
  active: number
  onChange: (i: number) => void
  className?: string
}) {
  return (
    <div className={cn("flex flex-wrap gap-px", className)}>
      {FILES.map((f, i) => (
        <button
          key={f.file}
          type="button"
          onClick={() => onChange(i)}
          className={cn(
            "rounded-md border px-2.5 py-1 text-xs transition-colors",
            i === active
              ? "border-primary bg-primary text-primary-foreground"
              : "bg-background text-muted-foreground hover:bg-muted"
          )}
        >
          {f.label}
        </button>
      ))}
    </div>
  )
}

function FileCanvas({ file }: { file: string }) {
  return (
    <div className="h-[min(680px,calc(100svh-10rem))] min-h-[420px] w-full rounded-xl shadow-sm">
      {/* Bounded viewport keeps long documents scrolling inside the viewer.
          key forces a fresh viewer per file so state (zoom, sheet, scroll) resets */}
      <FileViewer
        key={file}
        source={{ kind: "url", url: `/samples/${file}`, fileName: file }}
        className="h-full"
        isolateStyles
      />
    </div>
  )
}

/** Standalone demo (docs): format tabs stacked above the viewer. */
export function FileViewerDemo() {
  const [active, setActive] = React.useState(0)
  return (
    <div className="not-prose my-6 flex flex-col gap-3">
      <FileTabs active={active} onChange={setActive} />
      <FileCanvas file={FILES[active].file} />
    </div>
  )
}

/**
 * Homepage showcase variant: the format tabs live in the header (where a
 * description would sit), so the viewer box top-aligns with the neighbouring
 * Schema Builder card. The header is given a fixed height shared with that card.
 */
export function FileViewerShowcase() {
  const [active, setActive] = React.useState(0)
  return (
    <div className="flex flex-col gap-3">
      <div className="flex min-h-(--showcase-header-h) flex-col gap-1.5">
        <h3 className="text-sm font-medium text-foreground">File Viewer</h3>
        <FileTabs active={active} onChange={setActive} />
      </div>
      <FileCanvas file={FILES[active].file} />
    </div>
  )
}
