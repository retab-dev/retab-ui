export type PageMarkdownViewMode = "rendered" | "text";

export interface PageMarkdownDocumentState {
  onCurrentPageChange: (pageNumber: number) => void;
  onScrollProgressChange?: (progress: number) => void;
  setDocumentHandle: (handle: PageMarkdownDocumentHandle | null) => void;
}

export interface PageMarkdownDocumentHandle {
  scrollToPage: (pageNumber: number, options?: ScrollToOptions) => void;
}

export interface PageMarkdownViewerProps {
  pages: string[];
  text?: string;
  isProcessing?: boolean;
  onVisiblePageChange?: (pageNumber: number) => void;
  fileName?: string;
  resetKey?: string;
  processingLabel?: string;
}
