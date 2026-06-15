"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import { ViewerHeader, ViewerSidebarTrigger } from "@/components/ui/viewer"

import { useInternalEditViewerHeader } from "./edit-viewer-internal-context"
import { EditViewerToolbar } from "./edit-viewer-toolbar"

export type EditViewerHeaderProps = React.ComponentProps<
  typeof ViewerHeader
> & {
  showSidebarTrigger?: boolean
}

export function EditViewerHeader({
  showSidebarTrigger = true,
  className,
  ...props
}: EditViewerHeaderProps) {
  const header = useInternalEditViewerHeader()

  if (header.modes.length === 0) return null

  return (
    <ViewerHeader className={cn("bg-background", className)} {...props}>
      <div className="flex min-w-0 items-center gap-2 px-2">
        {showSidebarTrigger && header.hasFieldPanel ? (
          <ViewerSidebarTrigger />
        ) : null}
        <EditViewerToolbar
          modes={header.modes}
          mode={header.mode}
          onModeChange={header.setMode}
          filledCount={header.filledCount}
          fieldCount={header.fieldCount}
          status={header.status}
        />
      </div>
    </ViewerHeader>
  )
}
