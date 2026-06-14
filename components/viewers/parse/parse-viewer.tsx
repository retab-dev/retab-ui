"use client"

import * as React from "react"

import { ViewerBody, ViewerRoot, ViewerSurface } from "@/components/ui/viewer"
import { type ParseResponse } from "@/components/viewers/lib/parse-types"
import {
  PageMarkdownViewerContent,
  PageMarkdownViewerProvider,
  usePageMarkdownViewerContent,
  usePageMarkdownViewerDocument,
} from "@/components/viewers/page-markdown/page-markdown-viewer"
import { type PageMarkdownDocumentState } from "@/components/viewers/page-markdown/page-markdown-types"

type ParseViewerContextValue = {
  isProcessing: boolean
  result: ParseResponse | null
}

const ParseViewerContext = React.createContext<ParseViewerContextValue | null>(
  null
)

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

export function useParseViewer() {
  const context = React.useContext(ParseViewerContext)
  if (!context) {
    throw new Error("useParseViewer must be used within ParseViewerProvider.")
  }
  return context
}

export function useParseViewerDocument(): ParseDocumentState {
  return usePageMarkdownViewerDocument()
}

export function useParseViewerMarkdown() {
  return usePageMarkdownViewerContent()
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
  const value = React.useMemo<ParseViewerContextValue>(
    () => ({ isProcessing, result }),
    [isProcessing, result]
  )

  return (
    <ParseViewerContext.Provider value={value}>
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
    </ParseViewerContext.Provider>
  )
}

export function ParseViewerMarkdown() {
  return <PageMarkdownViewerContent />
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
        <ViewerBody>
          <ViewerSurface>
            <ParseViewerMarkdown />
          </ViewerSurface>
        </ViewerBody>
      </ViewerRoot>
    </ParseViewerProvider>
  )
}
