"use client"

import * as React from "react"

import { scrollDocumentPageIntoView } from "@/components/viewers/page-markdown/page-markdown-document-dom"
import {
  type PageMarkdownDocumentHandlers,
  type PageMarkdownViewerProps,
} from "@/components/viewers/page-markdown/page-markdown-types"

export interface PageMarkdownDocumentPaneHandle {
  scrollToPage: (pageNumber: number) => void
}

export const PageMarkdownDocumentPane = React.forwardRef<
  PageMarkdownDocumentPaneHandle,
  {
    renderDocument: NonNullable<PageMarkdownViewerProps["renderDocument"]>
    onCurrentPageChange: PageMarkdownDocumentHandlers["onCurrentPageChange"]
    onScrollProgressChange: NonNullable<
      PageMarkdownDocumentHandlers["onScrollProgressChange"]
    >
  }
>(function PageMarkdownDocumentPane(
  { renderDocument, onCurrentPageChange, onScrollProgressChange },
  ref
) {
  const documentPaneRef = React.useRef<HTMLDivElement | null>(null)

  React.useImperativeHandle(
    ref,
    () => ({
      scrollToPage(pageNumber) {
        scrollDocumentPageIntoView(documentPaneRef.current, pageNumber)
      },
    }),
    []
  )

  return (
    <div ref={documentPaneRef} className="h-full min-w-0">
      {renderDocument({ onCurrentPageChange, onScrollProgressChange })}
    </div>
  )
})
