"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import { FileViewer } from "@/components/ui/file-viewer"
import { TextViewer } from "@/components/ui/text-viewer"
import {
  LONG_TEXT_SAMPLE,
  LONG_TEXT_SAMPLE_FILE_NAME,
  LONG_TEXT_SAMPLE_MIME_TYPE,
} from "@/components/long-text-sample"

type DemoFile =
  | {
      label: string
      file: string
      viewer?: "file"
    }
  | {
      label: string
      file: string
      viewer: "text"
    }

const FILES = [
  { label: "PDF", file: "spacex-prospectus.pdf" },
  { label: "Image", file: "an-image-is-worth-16x16-words-page-1.png" },
  { label: "TIFF", file: "entropy.tiff" },
  { label: "XLSX", file: "nvidia-financials-fy2024.xlsx" },
  { label: "PPTX", file: "sample-presentation.pptx" },
  { label: "DOCX", file: "quarterly-business-review.docx" },
  { label: "CSV", file: "sales.csv" },
  { label: "Markdown", file: "release-notes.md" },
  { label: "HTML", file: "welcome.html" },
  { label: "JSON", file: "app-config.json" },
  { label: "Code", file: "use-debounced-value.ts" },
  { label: "Text", file: "review-notes.txt", viewer: "text" },
] as const satisfies readonly DemoFile[]

const SHOWCASE_FILES = FILES.filter((file) => file.label !== "Code").map(
  (file) => (file.label === "JSON" ? { ...file, label: "Code" } : file)
)
const TEXT_FILE_INDEX = SHOWCASE_FILES.findIndex(
  (file) => file.label === "Text"
)
const SHOWCASE_INITIAL_FILE_INDEX = TEXT_FILE_INDEX === -1 ? 0 : TEXT_FILE_INDEX

function getActiveFile(files: readonly DemoFile[], active: number) {
  return files[active] ?? files[0]
}

function FileTabs({
  active,
  files = FILES,
  onChange,
  className,
}: {
  active: number
  files?: readonly DemoFile[]
  onChange: (i: number) => void
  className?: string
}) {
  return (
    <div className={cn("flex flex-wrap gap-[3px]", className)}>
      {files.map((f, i) => (
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

function FileCanvas({ file }: { file: DemoFile }) {
  const urlSource = {
    kind: "url" as const,
    url: `/samples/${file.file}`,
    fileName: file.file,
  }

  return (
    <div className="h-[min(680px,calc(100svh-10rem))] min-h-[420px] w-full rounded-xl shadow-sm">
      {/* Bounded viewport keeps long documents scrolling inside the viewer.
          key forces a fresh viewer per file so state (zoom, sheet, scroll) resets */}
      {file.viewer === "text" ? (
        <TextViewer
          key={file.file}
          source={{
            kind: "text",
            text: LONG_TEXT_SAMPLE,
            fileName: LONG_TEXT_SAMPLE_FILE_NAME,
            mimeType: LONG_TEXT_SAMPLE_MIME_TYPE,
          }}
          className="h-full"
        />
      ) : (
        <FileViewer
          key={file.file}
          source={urlSource}
          className="h-full"
          isolateStyles
        />
      )}
    </div>
  )
}

/** Standalone demo (docs): format tabs stacked above the viewer. */
export function FileViewerDemo() {
  const [active, setActive] = React.useState(0)
  const activeFile = getActiveFile(FILES, active)

  return (
    <div className="not-prose my-6 flex flex-col gap-3">
      <FileTabs active={active} onChange={setActive} />
      <FileCanvas file={activeFile} />
    </div>
  )
}

/**
 * Homepage showcase variant: the format tabs live in the header (where a
 * description would sit), so the viewer box top-aligns with the neighbouring
 * Schema Builder card. The header is given a fixed height shared with that card.
 */
export function FileViewerShowcase() {
  const [active, setActive] = React.useState(SHOWCASE_INITIAL_FILE_INDEX)
  const activeFile = getActiveFile(SHOWCASE_FILES, active)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex min-h-(--showcase-header-h) flex-col gap-1.5">
        <h3 className="text-sm font-medium text-foreground">File Viewer</h3>
        <FileTabs active={active} files={SHOWCASE_FILES} onChange={setActive} />
      </div>
      <FileCanvas file={activeFile} />
    </div>
  )
}
