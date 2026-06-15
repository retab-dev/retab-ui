"use client"

import * as React from "react"

import { ViewerBody, ViewerRoot, ViewerSurface } from "@/components/ui/viewer"
import { type ParseResponse } from "@/components/viewers/lib/parse-types"
import { type PageMarkdownDocumentState } from "@/components/viewers/page-markdown/page-markdown-types"
import {
  PageMarkdownViewerContent,
  PageMarkdownViewerHeader,
  PageMarkdownViewerProvider,
  usePageMarkdownViewerDocument,
} from "@/components/viewers/page-markdown/page-markdown-viewer"

export interface ParseViewerProviderProps {
  result: ParseResponse | null
  isProcessing?: boolean
  onVisiblePageChange?: (pageNumber: number) => void
  children: React.ReactNode
}

export interface ParseViewerProps {
  result: ParseResponse | null
  isProcessing?: boolean
  onVisiblePageChange?: (pageNumber: number) => void
}

export type ParseDocumentState = PageMarkdownDocumentState

export function useParseViewerDocument(): ParseDocumentState {
  return usePageMarkdownViewerDocument()
}

export function ParseViewerProvider({
  result,
  isProcessing = false,
  onVisiblePageChange,
  children,
}: ParseViewerProviderProps) {
  const pages = result?.output?.pages ?? []
  const text = result?.output?.text ?? undefined
  const resetKey = result?.document?.id

  return (
    <PageMarkdownViewerProvider
      pages={pages}
      text={text}
      isProcessing={isProcessing}
      onVisiblePageChange={onVisiblePageChange}
      resetKey={resetKey}
      fileName="parse-output.md"
      processingLabel="Parsing document..."
    >
      {children}
    </PageMarkdownViewerProvider>
  )
}

export function ParseViewerMarkdown() {
  return <PageMarkdownViewerContent />
}

export function ParseViewerHeader({ className }: { className?: string }) {
  return <PageMarkdownViewerHeader className={className} />
}

export function ParseViewer({
  result,
  isProcessing = false,
  onVisiblePageChange,
}: ParseViewerProps) {
  return (
    <ParseViewerProvider
      result={result}
      isProcessing={isProcessing}
      onVisiblePageChange={onVisiblePageChange}
    >
      <ViewerRoot bare className="h-full flex-1 bg-background">
        <ParseViewerHeader />
        <ViewerBody>
          <ViewerSurface>
            <ParseViewerMarkdown />
          </ViewerSurface>
        </ViewerBody>
      </ViewerRoot>
    </ParseViewerProvider>
  )
}
