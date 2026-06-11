"use client"

import * as React from "react"
import { Maximize, Minus, Plus } from "lucide-react"

import { useElementWidth } from "@/hooks/use-element-width"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
  downloadFileName,
  onModeChange,
  onZoom,
  onFitWidth,
}: {
  currentPage: number
  pageCount: number
  mode: PageMarkdownViewMode
  scale: number
  text: string
  downloadFileName: string
  onModeChange: (mode: PageMarkdownViewMode) => void
  onZoom: (factor: number) => void
  onFitWidth: () => void
}) {
  const [toolbarRef, toolbarWidth] = useElementWidth()
  const isCompact =
    toolbarWidth !== null && toolbarWidth < PAGE_MARKDOWN_COMPACT_ACTIONS_WIDTH

  return (
    <div
      ref={toolbarRef}
      className="no-scrollbar flex h-10 shrink-0 items-center gap-1 overflow-x-auto border-b bg-card px-2"
    >
      <div className="flex min-w-0 shrink-0 items-center gap-1">
        <span className="px-1 text-xs whitespace-nowrap text-muted-foreground tabular-nums">
          Page {currentPage} of {pageCount}
        </span>
        <ModeTabs mode={mode} onChange={onModeChange} />
      </div>
      <div className="ml-auto flex shrink-0 items-center gap-1">
        <ToolbarIconButton label="Zoom out" onClick={() => onZoom(1 / 1.2)}>
          <Minus />
        </ToolbarIconButton>
        <span className="w-12 text-center text-xs text-muted-foreground tabular-nums">
          {Math.round(scale * 100)}%
        </span>
        <ToolbarIconButton label="Zoom in" onClick={() => onZoom(1.2)}>
          <Plus />
        </ToolbarIconButton>
        <ToolbarIconButton label="Fit width" onClick={onFitWidth}>
          <Maximize />
        </ToolbarIconButton>
        <Separator orientation="vertical" className="mx-1 h-4" />
        {isCompact ? (
          <MarkdownActionsMenu text={text} fileName={downloadFileName} />
        ) : (
          <MarkdownActionButtons text={text} fileName={downloadFileName} />
        )}
      </div>
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

function ToolbarIconButton({
  label,
  children,
  ...props
}: React.ComponentProps<typeof Button> & { label: string }) {
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      className="size-7"
      aria-label={label}
      title={label}
      {...props}
    >
      {children}
    </Button>
  )
}
