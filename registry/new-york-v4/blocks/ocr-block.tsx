"use client"

import documentAiOutput from "@/sample/documentai-output.json"

import {
  DocumentAiLayoutBlocks,
  type DocumentAiDocument,
} from "@/components/ui/layout-blocks"

const OCR_OUTPUT = documentAiOutput as DocumentAiDocument

/**
 * OCR block — a scanned document image beside its OCR blocks, confidence, and
 * source polygons. Built from Google Document AI output.
 */
export function OcrBlock() {
  return (
    <div className="h-full min-h-[680px] bg-background">
      <DocumentAiLayoutBlocks heightClassName="h-full" output={OCR_OUTPUT} />
    </div>
  )
}
