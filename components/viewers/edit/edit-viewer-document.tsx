"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

import { EditViewerDocumentPane } from "./edit-viewer-document-pane"
import { useEditViewerDocument } from "./edit-viewer-provider"

export type EditViewerDocumentProps = React.ComponentProps<"div">

export function EditViewerDocument({
  className,
  ...props
}: EditViewerDocumentProps) {
  const document = useEditViewerDocument()

  return (
    <div className={cn("h-full", className)} {...props}>
      <EditViewerDocumentPane
        target={document.target}
        renderPageOverlay={document.renderPageOverlay}
        viewerRef={document.viewerRef}
      />
    </div>
  )
}
