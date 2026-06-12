"use client"

import * as React from "react"

import { scrollPageIntoView } from "@/components/viewers/page-markdown/page-markdown-dom"
import {
  type PageMarkdownDocumentHandlers,
  type PageMarkdownViewerProps,
} from "@/components/viewers/page-markdown/page-markdown-types"

export interface PageMarkdownDocumentPaneHandle {
  scrollToPage: (page: number) => void
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
      scrollToPage(page) {
        scrollPageIntoView(documentPaneRef.current, page)
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
