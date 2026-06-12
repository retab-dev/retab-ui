"use client"

import { type ParseResponse } from "@/components/viewers/lib/parse-types"
import {
  type PageMarkdownDocumentHandlers,
  type PageMarkdownViewerProps,
} from "@/components/viewers/page-markdown/page-markdown-types"
import { PageMarkdownViewer } from "@/components/viewers/page-markdown/page-markdown-viewer"

export type ParseDocumentHandlers = PageMarkdownDocumentHandlers

export interface ParseViewerProps {
  result: ParseResponse | null
  isProcessing?: boolean
  renderDocument?: PageMarkdownViewerProps["renderDocument"]
  onVisiblePageChange?: (page: number) => void
}

export function ParseViewer({
  result,
  isProcessing = false,
  renderDocument,
  onVisiblePageChange,
}: ParseViewerProps) {
  const pages = result?.output?.pages ?? []
  const text = result?.output?.text || undefined

  return (
    <PageMarkdownViewer
      pages={pages}
      text={text}
      isProcessing={isProcessing}
      renderDocument={renderDocument}
      onVisiblePageChange={onVisiblePageChange}
      downloadFileName="parse-output.md"
      processingLabel="Parsing document..."
    />
  )
}
