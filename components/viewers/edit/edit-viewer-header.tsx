"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import { ViewerHeader, ViewerSidebarTrigger } from "@/components/ui/viewer"

import { useEditViewerChromeState } from "./edit-viewer-provider"
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
  const edit = useEditViewerChromeState()

  if (edit.modes.length === 0) return null

  return (
    <ViewerHeader className={cn("bg-background", className)} {...props}>
      <div className="flex min-w-0 items-center gap-2 px-2">
        {showSidebarTrigger && edit.hasFieldPanel ? (
          <ViewerSidebarTrigger />
        ) : null}
        <EditViewerToolbar
          modes={edit.modes}
          mode={edit.mode}
          onModeChange={edit.setMode}
          status={edit.status}
        />
      </div>
    </ViewerHeader>
  )
}
