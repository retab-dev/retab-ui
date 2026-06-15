"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import { ViewerHeader, ViewerSidebarTrigger } from "@/components/ui/viewer"

import { EditViewerToolbar } from "./edit-viewer-toolbar"
import type { EditViewerMode, EditViewerStatus } from "./edit-viewer-types"

export type EditViewerHeaderViewProps = React.ComponentProps<
  typeof ViewerHeader
> & {
  hasFieldPanel: boolean
  mode: EditViewerMode | null
  modes: readonly EditViewerMode[]
  onModeChange: (mode: EditViewerMode) => void
  showSidebarTrigger?: boolean
  status: Exclude<EditViewerStatus, { state: "idle" }> | null
}

export function EditViewerHeaderView({
  hasFieldPanel,
  mode,
  modes,
  onModeChange,
  showSidebarTrigger = true,
  status,
  className,
  ...props
}: EditViewerHeaderViewProps) {
  if (modes.length === 0) return null

  return (
    <ViewerHeader className={cn("bg-background", className)} {...props}>
      <div className="flex min-w-0 items-center gap-2 px-2">
        {showSidebarTrigger && hasFieldPanel ? <ViewerSidebarTrigger /> : null}
        <EditViewerToolbar
          modes={modes}
          mode={mode}
          onModeChange={onModeChange}
          status={status}
        />
      </div>
    </ViewerHeader>
  )
}
