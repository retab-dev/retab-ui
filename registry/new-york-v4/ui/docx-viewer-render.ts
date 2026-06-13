import type * as DocxPreview from "docx-preview"

import { ViewerFormatError } from "@/lib/viewer-errors"

import {
  DEFAULT_DOCX_PAGE_HEIGHT,
  DEFAULT_DOCX_PAGE_WIDTH,
  DOCX_RENDER_OPTIONS,
  positivePixel,
} from "./docx-viewer-core"

let docxPromise: Promise<typeof DocxPreview> | null = null

export function loadDocxPreview() {
  if (!docxPromise) {
    docxPromise = import("docx-preview").catch((error) => {
      docxPromise = null
      throw error
    })
  }
  return docxPromise
}

export async function renderDocxPreview(buffer: ArrayBuffer) {
  const { renderAsync } = await loadDocxPreview()
  const renderHost = document.createElement("div")
  await renderAsync(buffer, renderHost, undefined, DOCX_RENDER_OPTIONS)
  return renderHost
}

export function commitDocxRender({
  host,
  renderHost,
  scale,
}: {
  host: HTMLElement
  renderHost: HTMLElement
  scale: number
}) {
  host.replaceChildren(...Array.from(renderHost.childNodes))
  const pages = Array.from(
    host.querySelectorAll<HTMLElement>(".docx-wrapper > section.docx")
  )
  if (!pages.length) {
    throw new ViewerFormatError({
      format: "docx",
      kind: "render_failed",
      message: "DOCX render produced no pages.",
    })
  }
  const z = scale || 1
  const sizes = pages.map((el) => {
    const r = el.getBoundingClientRect()
    const width = positivePixel(Math.round(r.width / z))
    const height = positivePixel(Math.round(r.height / z))
    return [
      width ?? DEFAULT_DOCX_PAGE_WIDTH,
      height ?? DEFAULT_DOCX_PAGE_HEIGHT,
    ] as const
  })
  pages.forEach((el, i) => {
    el.dataset.pageNumber = String(i + 1)
    el.style.contentVisibility = "auto"
    el.style.containIntrinsicSize = `${sizes[i][0]}px ${sizes[i][1]}px`
  })
  return {
    numPages: pages.length,
    pageWidth: pages.length ? sizes[0][0] : null,
  }
}
