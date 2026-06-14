"use client"

import * as React from "react"

import { useElementWidth } from "@/hooks/use-element-width"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ViewerToolbar } from "@/components/ui/viewer-toolbar"
import {
  MarkdownActionButtons,
  MarkdownActionsMenu,
} from "@/components/viewers/page-markdown/page-markdown-actions"
import { PAGE_MARKDOWN_COMPACT_ACTIONS_WIDTH } from "@/components/viewers/page-markdown/page-markdown-model"
import { type PageMarkdownViewMode } from "@/components/viewers/page-markdown/page-markdown-types"

export function PageMarkdownToolbar({
  currentPage,
  pageCount,
  mode,
  scale,
  text,
  fileName,
  onModeChange,
  onZoom,
  onFitWidth,
}: {
  currentPage: number
  pageCount: number
  mode: PageMarkdownViewMode
  scale: number
  text: string
  fileName: string
  onModeChange: (mode: PageMarkdownViewMode) => void
  onZoom: (factor: number) => void
  onFitWidth: () => void
}) {
  const [toolbarRef, toolbarWidth] = useElementWidth()
  const isCompact =
    toolbarWidth !== null && toolbarWidth < PAGE_MARKDOWN_COMPACT_ACTIONS_WIDTH

  return (
    <div ref={toolbarRef} className="shrink-0">
      <ViewerToolbar
        title={
          <div className="flex min-w-0 items-center">
            <ModeTabs mode={mode} onChange={onModeChange} />
          </div>
        }
        position={{ kind: "page", current: currentPage, total: pageCount }}
        zoom={{
          scale,
          onZoomOut: () => onZoom(1 / 1.2),
          onZoomIn: () => onZoom(1.2),
          onFit: onFitWidth,
        }}
        extra={
          isCompact ? (
            <MarkdownActionsMenu text={text} fileName={fileName} />
          ) : (
            <MarkdownActionButtons text={text} fileName={fileName} />
          )
        }
      />
    </div>
  )
}

function ModeTabs({
  mode,
  onChange,
}: {
  mode: PageMarkdownViewMode
  onChange: (mode: PageMarkdownViewMode) => void
}) {
  return (
    <Tabs
      value={mode}
      onValueChange={(value) => onChange(value as PageMarkdownViewMode)}
    >
      <TabsList variant="underline" className="py-0">
        <TabsTrigger value="rendered" className="h-8 text-xs sm:text-xs">
          Rendered
        </TabsTrigger>
        <TabsTrigger value="text" className="h-8 text-xs sm:text-xs">
          Text
        </TabsTrigger>
      </TabsList>
    </Tabs>
  )
}
