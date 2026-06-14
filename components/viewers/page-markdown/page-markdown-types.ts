export type PageMarkdownViewMode = "rendered" | "text"

export interface PageMarkdownDocumentState {
  onCurrentPageChange: (pageNumber: number) => void
  onScrollProgressChange?: (progress: number) => void
  scrollRequest: PageMarkdownDocumentScrollRequest | null
}

export interface PageMarkdownDocumentScrollRequest {
  pageNumber: number
  version: number
}

export interface PageMarkdownViewerProps {
  pages: string[]
  text?: string
  isProcessing?: boolean
  onVisiblePageChange?: (pageNumber: number) => void
  fileName?: string
  resetKey?: string
  processingLabel?: string
}
