"use client"

import * as React from "react"

import { Spinner } from "@/components/ui/spinner"
import { PageMarkdownContent } from "@/components/viewers/page-markdown/page-markdown-content"
import { useMarkdownPageMeasurement } from "@/components/viewers/page-markdown/page-markdown-hooks"
import {
  PAGE_MARKDOWN_PAGE_PADDING_X,
  PAGE_MARKDOWN_PAGE_PADDING_Y,
  PAGE_MARKDOWN_PAGE_WIDTH,
} from "@/components/viewers/page-markdown/page-markdown-model"
import { type PageMarkdownViewMode } from "@/components/viewers/page-markdown/page-markdown-types"

export const PageMarkdownPageFrame = React.memo(function PageMarkdownPageFrame({
  page,
  markdown,
  mode,
  scale,
}: {
  page: number
  markdown: string
  mode: PageMarkdownViewMode
  scale: number
}) {
  const [isNearViewport, setIsNearViewport] = React.useState(false)
  const { reservedHeight, measureRef } = useMarkdownPageMeasurement({
    markdown,
    mode,
    scale,
  })

  const pageRef = React.useCallback(
    (pageElement: HTMLDivElement | null) => {
      if (!pageElement) return

      const cleanupMeasurement = measureRef(pageElement)
      const root = pageElement.closest<HTMLElement>(
        '[data-slot="scroll-area-viewport"]'
      )
      if (typeof IntersectionObserver !== "function") {
        setIsNearViewport(true)
        return () => cleanupMeasurement?.()
      }

      const observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            setIsNearViewport(entry.isIntersecting)
          }
        },
        { root, rootMargin: "200% 0px" }
      )

      observer.observe(pageElement)
      return () => {
        observer.disconnect()
        cleanupMeasurement?.()
      }
    },
    [measureRef]
  )

  return (
    <div
      ref={pageRef}
      data-slot="page-markdown-page"
      data-page-number={page}
      className="relative w-full max-w-3xl bg-card shadow-sm ring-1 ring-border"
      style={{
        width: `${PAGE_MARKDOWN_PAGE_WIDTH * scale}px`,
        maxWidth: scale <= 1 ? "100%" : "none",
        paddingInline: `${PAGE_MARKDOWN_PAGE_PADDING_X * scale}px`,
        paddingBlock: `${PAGE_MARKDOWN_PAGE_PADDING_Y * scale}px`,
        ...(isNearViewport ? null : { height: reservedHeight }),
      }}
    >
      {isNearViewport ? (
        <PageMarkdownContent markdown={markdown} mode={mode} scale={scale} />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center">
          <Spinner className="size-4 text-muted-foreground" />
        </div>
      )}
    </div>
  )
})
