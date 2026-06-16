"use client"

import * as React from "react"

import {
  DocumentAiLayoutBlocks,
  type DocumentAiDocument,
} from "@/components/ui/layout-blocks"

/**
 * OCR block — a scanned document image beside its OCR blocks, confidence, and
 * source polygons. Built from Google Document AI output.
 *
 * The Document AI sample is ~21 MB, so it is loaded on demand with a dynamic
 * import rather than bundled into the page's initial JavaScript.
 */
export function OcrBlock() {
  const [output, setOutput] = React.useState<DocumentAiDocument | null>(null)

  React.useEffect(() => {
    let active = true
    void import("@/sample/documentai-output.json").then((module) => {
      if (active) setOutput(module.default as DocumentAiDocument)
    })
    return () => {
      active = false
    }
  }, [])

  return (
    <div className="h-full min-h-[680px] bg-background">
      {output ? (
        <DocumentAiLayoutBlocks heightClassName="h-full" output={output} />
      ) : (
        <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
          Loading OCR sample…
        </div>
      )}
    </div>
  )
}
