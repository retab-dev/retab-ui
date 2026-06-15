"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import type {
  PageOverlayProps,
  PdfViewerHandle,
} from "@/components/ui/pdf-viewer"

import { EditViewerDocumentPane } from "./edit-viewer-document-pane"
import type { EditViewerDocumentTarget } from "./edit-viewer-model"

export type EditViewerDocumentViewProps = React.ComponentProps<"div"> & {
  target: EditViewerDocumentTarget
  renderPageOverlay: (props: PageOverlayProps) => React.ReactNode
  viewerRef: React.RefObject<PdfViewerHandle | null>
}

export function EditViewerDocumentView({
  className,
  renderPageOverlay,
  target,
  viewerRef,
  ...props
}: EditViewerDocumentViewProps) {
  return (
    <div className={cn("h-full", className)} {...props}>
      <EditViewerDocumentPane
        target={target}
        renderPageOverlay={renderPageOverlay}
        viewerRef={viewerRef}
      />
    </div>
  )
}
