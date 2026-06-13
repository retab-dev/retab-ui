"use client"

import * as React from "react"
import type * as DocxPreview from "docx-preview"

import { getDocxDocumentResource } from "@/lib/docx-document-resource"
import type { ViewerResource } from "@/lib/viewer-resource"
import {
  Surface,
  useElementWidth,
} from "@/components/document-thumbnail/renderers/layout"
import { withThumbnailDecodeSlot } from "@/components/document-thumbnail/thumbnail-decode-queue"
import { withThumbnailFormatError } from "@/components/document-thumbnail/thumbnail-errors"
import {
  shortName,
  timedThumbnail,
} from "@/components/document-thumbnail/thumbnail-profile"
import { useThumbnailResource } from "@/components/document-thumbnail/thumbnail-resource"

let docxLib: Promise<typeof DocxPreview> | null = null
function loadDocxPreview() {
  if (!docxLib) docxLib = import("docx-preview")
  return docxLib
}

const DOCX_PAGE_W = 816 // US Letter at 96dpi

export function DocxFirstPage({ resource }: { resource: ViewerResource }) {
  const bytes = useThumbnailResource(getDocxDocumentResource(resource.content))
  const { ref: frameRef, width: frameWidth } = useElementWidth()
  const [renderError, setRenderError] = React.useState<unknown>(null)

  const renderRef = React.useCallback(
    (el: HTMLDivElement | null) => {
      if (!el) return
      let active = true
      void withThumbnailDecodeSlot(() =>
        withThumbnailFormatError(
          "docx",
          "render_failed",
          resource.fileName,
          "Failed to render DOCX thumbnail",
          () =>
            timedThumbnail(`docx:render ${shortName(resource)}`, async () => {
              if (!active) return
              const docx = await loadDocxPreview()
              if (!active) return
              el.innerHTML = ""
              await docx.renderAsync(bytes.slice(0), el, undefined, {
                inWrapper: true,
                breakPages: true,
                ignoreLastRenderedPageBreak: false,
                experimental: true,
              })
            })
        )
      ).catch((error) => {
        if (active) setRenderError(error)
      })
      return () => {
        active = false
      }
    },
    [bytes, resource]
  )

  const scale = frameWidth ? frameWidth / DOCX_PAGE_W : null

  if (renderError) throw renderError

  return (
    <Surface>
      <div ref={frameRef} className="absolute inset-0 overflow-hidden bg-white">
        <div
          className="absolute top-0 left-0 origin-top-left [&_.docx-wrapper]:!bg-transparent [&_.docx-wrapper]:!p-0 [&_section.docx]:!mb-0 [&_section.docx]:!shadow-none"
          style={{
            width: DOCX_PAGE_W,
            transform: scale ? `scale(${scale})` : undefined,
            visibility: scale ? "visible" : "hidden",
          }}
        >
          <div ref={renderRef} />
        </div>
      </div>
    </Surface>
  )
}
