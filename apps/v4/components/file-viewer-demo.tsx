"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import { FileViewer } from "@/components/ui/file-viewer"

const FILES = [
  { label: "PDF", file: "loan-application.pdf" },
  { label: "Image", file: "attention-page-1.png" },
  { label: "XLSX", file: "nvidia-financials-fy2024.xlsx" },
  { label: "PPTX", file: "sample-deck.pptx" },
  { label: "DOCX", file: "demo.docx" },
  { label: "CSV", file: "sales.csv" },
  { label: "Markdown", file: "release-notes.md" },
  { label: "HTML", file: "welcome.html" },
  { label: "JSON", file: "app-config.json" },
  { label: "Log", file: "server.log" },
]

export function FileViewerDemo() {
  const [active, setActive] = React.useState(0)
  const current = FILES[active]

  return (
    <div className="not-prose my-6 flex flex-col gap-3">
      <div className="flex flex-wrap gap-1.5">
        {FILES.map((f, i) => (
          <button
            key={f.file}
            type="button"
            onClick={() => setActive(i)}
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
      <div className="h-[600px]">
        {/* key forces a fresh viewer per file so state (zoom, sheet, scroll) resets */}
        <FileViewer
          key={current.file}
          src={`/samples/${current.file}`}
          fileName={current.file}
          className="h-full"
        />
      </div>
    </div>
  )
}
