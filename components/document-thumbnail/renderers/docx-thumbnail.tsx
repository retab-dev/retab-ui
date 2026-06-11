"use client"

import * as React from "react"
import type * as DocxPreview from "docx-preview"

import {
  shortName,
  timed,
  withDecodeSlot,
} from "@/components/document-thumbnail/cache"
import {
  Surface,
  useElementWidth,
} from "@/components/document-thumbnail/renderers/layout"

let docxLib: Promise<typeof DocxPreview> | null = null
function loadDocxPreview() {
  if (!docxLib) docxLib = import("docx-preview")
  return docxLib
}

const docxCache = new Map<string, Promise<ArrayBuffer>>()

function getDocxBytes(src: string, resourceKey = src): Promise<ArrayBuffer> {
  let promise = docxCache.get(resourceKey)
  if (!promise) {
    promise = timed(`docx:fetch ${shortName(src)}`, () =>
      fetch(src).then((res) => {
        if (!res.ok) throw new Error(`Failed to load DOCX: ${res.status}`)
        return res.arrayBuffer()
      })
    )
    docxCache.set(resourceKey, promise)
  }
  return promise
}

const DOCX_PAGE_W = 816 // US Letter at 96dpi

export function DocxFirstPage({
  src,
  resourceKey,
}: {
  src: string
  resourceKey: string
}) {
  const bytes = React.use(getDocxBytes(src, resourceKey))
  const { ref: frameRef, width: frameWidth } = useElementWidth()

  const renderRef = React.useCallback(
    (el: HTMLDivElement | null) => {
      if (!el) return
      let active = true
      void withDecodeSlot(() =>
        timed(`docx:render ${shortName(src)}`, async () => {
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
      return () => {
        active = false
      }
    },
    [bytes, src]
  )

  const scale = frameWidth ? frameWidth / DOCX_PAGE_W : null

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
