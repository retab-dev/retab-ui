"use client"

import * as React from "react"

import { FileViewer } from "@/components/ui/file-viewer"
import {
  PdfViewer,
  type PageOverlayProps,
  type PdfViewerHandle,
} from "@/components/ui/pdf-viewer"

import { canPreviewEditViewerDocument } from "./edit-viewer-model"
import { EditViewerErrorState, NoDocumentState } from "./edit-viewer-states"
import type {
  EditViewerDocument,
  EditViewerMode,
  EditViewerStatus,
} from "./edit-viewer-types"

export function EditViewerDocumentPane({
  mode,
  sourceDocument,
  filledDocument,
  renderPageOverlay,
  viewerRef,
  status,
}: {
  mode: EditViewerMode | null
  sourceDocument?: EditViewerDocument | null
  filledDocument?: EditViewerDocument | null
  renderPageOverlay: (props: PageOverlayProps) => React.ReactNode
  viewerRef: React.RefObject<PdfViewerHandle | null>
  status: EditViewerStatus
}) {
  if (status.state === "error") {
    return <EditViewerErrorState message={status.message} />
  }

  if (mode === "filled" && filledDocument) {
    return <FilledDocumentRenderer document={filledDocument} />
  }

  if ((mode === "source" || mode === "preview") && sourceDocument) {
    return (
      <SourceDocumentRenderer
        document={sourceDocument}
        renderPageOverlay={renderPageOverlay}
        viewerRef={viewerRef}
        showPreview={mode === "preview"}
      />
    )
  }

  if (!mode) {
    return <NoDocumentState message="No edit view is available." />
  }

  return <NoDocumentState message="Document preview is unavailable." />
}

function SourceDocumentRenderer({
  document,
  renderPageOverlay,
  viewerRef,
  showPreview,
}: {
  document: EditViewerDocument
  renderPageOverlay: (props: PageOverlayProps) => React.ReactNode
  viewerRef: React.RefObject<PdfViewerHandle | null>
  showPreview: boolean
}) {
  const src = useDocumentSrc(document)
  if (!src) {
    return <NoDocumentState message="Document preview is unavailable." />
  }

  const filename = document.filename ?? "document"

  if (canPreviewEditViewerDocument(document)) {
    return (
      <PdfViewer
        ref={viewerRef}
        source={{ kind: "url", url: src, fileName: filename }}
        bare
        className="h-full"
        renderPageOverlay={showPreview ? renderPageOverlay : undefined}
      />
    )
  }

  if (showPreview) {
    return <NoDocumentState message="Preview requires a PDF source document." />
  }

  return (
    <FileViewer
      source={{
        kind: "url",
        url: src,
        fileName: filename,
        mimeType: document.mimeType,
      }}
      bare
      className="h-full"
    />
  )
}

function FilledDocumentRenderer({
  document,
}: {
  document: EditViewerDocument
}) {
  const src = useDocumentSrc(document)
  if (!src) {
    return <NoDocumentState message="Document preview is unavailable." />
  }

  return (
    <FileViewer
      source={{
        kind: "url",
        url: src,
        fileName: document.filename ?? "document",
        mimeType: document.mimeType,
      }}
      bare
      className="h-full"
    />
  )
}

function useDocumentSrc(document: EditViewerDocument) {
  const objectUrl = useObjectUrl(
    document.src ? null : (document.buffer ?? null),
    document.mimeType
  )

  return document.src ?? objectUrl
}

function useObjectUrl(buffer: ArrayBuffer | null, mimeType: string) {
  const [objectUrl, setObjectUrl] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!buffer) {
      setObjectUrl(null)
      return
    }

    const url = URL.createObjectURL(new Blob([buffer], { type: mimeType }))
    setObjectUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [buffer, mimeType])

  return objectUrl
}
