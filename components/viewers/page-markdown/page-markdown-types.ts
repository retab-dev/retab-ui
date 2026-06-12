import { type ReactNode } from "react"

export type PageMarkdownViewMode = "rendered" | "text"

export interface PageMarkdownDocumentHandlers {
  onCurrentPageChange: (page: number) => void
  onScrollProgressChange?: (progress: number) => void
}

export interface PageMarkdownViewerProps {
  pages: string[]
  text?: string
  isProcessing?: boolean
  renderDocument?: (handlers: PageMarkdownDocumentHandlers) => ReactNode
  onVisiblePageChange?: (page: number) => void
  downloadFileName?: string
  processingLabel?: string
}
