import { type ReactNode } from "react"

export type PageMarkdownViewMode = "rendered" | "text"

export interface PageMarkdownDocumentHandlers {
  onCurrentPageChange: (pageNumber: number) => void
  onScrollProgressChange?: (progress: number) => void
}

export interface PageMarkdownViewerProps {
  pages: string[]
  text?: string
  isProcessing?: boolean
  renderDocument?: (handlers: PageMarkdownDocumentHandlers) => ReactNode
  onVisiblePageChange?: (pageNumber: number) => void
  fileName?: string
  resetKey?: string
  processingLabel?: string
}
