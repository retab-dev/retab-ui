// @vitest-environment jsdom
import * as React from "react"
import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import type { Source, SourceAnchor } from "@/lib/document-source"
import {
  pdfAnchorToTarget,
  renderPdfSourceOverlay,
  usePdfSourceTarget,
} from "@/registry/new-york-v4/ui/pdf-source"
import type { PdfViewerHandle } from "@/registry/new-york-v4/ui/pdf-viewer"

afterEach(() => {
  cleanup()
})

function pdfBbox(
  overrides: Partial<Omit<SourceAnchor & { kind: "pdf_bbox" }, "kind">> = {}
): SourceAnchor {
  return {
    kind: "pdf_bbox",
    page: 2,
    left: 0.1,
    top: 0.2,
    width: 0.3,
    height: 0.4,
    ...overrides,
  }
}

function imageBbox(
  overrides: Partial<Omit<SourceAnchor & { kind: "image_bbox" }, "kind">> = {}
): SourceAnchor {
  return {
    kind: "image_bbox",
    left: 0.1,
    top: 0.2,
    width: 0.3,
    height: 0.4,
    ...overrides,
  }
}

describe("pdfAnchorToTarget", () => {
  it("scales a normalized pdf bbox into page percentages", () => {
    expect(pdfAnchorToTarget(pdfBbox())).toEqual({
      page: 2,
      area: { left: 10, top: 20, width: 30, height: 40 },
    })
  })

  it("accepts a box that fills the whole page", () => {
    expect(
      pdfAnchorToTarget(pdfBbox({ left: 0, top: 0, width: 1, height: 1 }))
    ).toEqual({
      page: 2,
      area: { left: 0, top: 0, width: 100, height: 100 },
    })
  })

  it("rejects pdf pages that are not positive integers", () => {
    expect(pdfAnchorToTarget(pdfBbox({ page: 0 }))).toBeUndefined()
    expect(pdfAnchorToTarget(pdfBbox({ page: -1 }))).toBeUndefined()
    expect(pdfAnchorToTarget(pdfBbox({ page: 1.5 }))).toBeUndefined()
    expect(pdfAnchorToTarget(pdfBbox({ page: Number.NaN }))).toBeUndefined()
  })

  it("rejects boxes that escape the unit square", () => {
    expect(
      pdfAnchorToTarget(pdfBbox({ left: 0.8, width: 0.5 }))
    ).toBeUndefined()
    expect(
      pdfAnchorToTarget(pdfBbox({ top: 0.8, height: 0.5 }))
    ).toBeUndefined()
    expect(pdfAnchorToTarget(pdfBbox({ left: -0.1 }))).toBeUndefined()
    expect(pdfAnchorToTarget(pdfBbox({ top: -0.1 }))).toBeUndefined()
  })

  it("rejects zero-area boxes", () => {
    expect(pdfAnchorToTarget(pdfBbox({ width: 0 }))).toBeUndefined()
    expect(pdfAnchorToTarget(pdfBbox({ height: 0 }))).toBeUndefined()
  })

  it("rejects non-finite box coordinates", () => {
    expect(pdfAnchorToTarget(pdfBbox({ left: Number.NaN }))).toBeUndefined()
    expect(
      pdfAnchorToTarget(pdfBbox({ width: Number.POSITIVE_INFINITY }))
    ).toBeUndefined()
  })

  it("maps any valid image bbox onto page 1", () => {
    expect(pdfAnchorToTarget(imageBbox())).toEqual({
      page: 1,
      area: { left: 10, top: 20, width: 30, height: 40 },
    })
    // Documented behavior: a multi-frame image still collapses to page 1, even
    // when a frame index is supplied.
    expect(pdfAnchorToTarget(imageBbox({ page: 5 }))?.page).toBe(1)
  })

  it("rejects image bboxes with an invalid frame index", () => {
    expect(pdfAnchorToTarget(imageBbox({ page: 0 }))).toBeUndefined()
    expect(pdfAnchorToTarget(imageBbox({ page: 2.5 }))).toBeUndefined()
  })

  it("accepts an image bbox without an explicit frame index", () => {
    expect(pdfAnchorToTarget(imageBbox({ page: undefined }))?.page).toBe(1)
  })

  it("returns undefined for non-bbox anchors", () => {
    const csv: SourceAnchor = { kind: "csv_cell", row: 1, column: "A" }
    const text: SourceAnchor = { kind: "text_span", line_start: 1, line_end: 2 }
    expect(pdfAnchorToTarget(csv)).toBeUndefined()
    expect(pdfAnchorToTarget(text)).toBeUndefined()
  })
})

describe("usePdfSourceTarget", () => {
  function makeSource(anchor: SourceAnchor): Source {
    return { content: "x", anchor }
  }

  function renderTarget(handle: PdfViewerHandle | null) {
    const ref = { current: handle } as React.RefObject<PdfViewerHandle | null>
    let target!: ReturnType<typeof usePdfSourceTarget>
    function Harness() {
      target = usePdfSourceTarget(ref)
      return null
    }
    render(<Harness />)
    return target
  }

  it("forwards a pdf anchor's page and top to the viewer handle", () => {
    const scrollToPageTarget = vi.fn()
    const target = renderTarget({
      scrollToPageTarget,
      getViewportElement: () => null,
    })

    target.scrollTo?.(makeSource(pdfBbox({ page: 3, top: 0.25 })), {
      behavior: "auto",
    })

    expect(scrollToPageTarget).toHaveBeenCalledWith(
      3,
      { top: 25 },
      { behavior: "auto" }
    )
  })

  it("does not call the handle for anchors with no pdf location", () => {
    const scrollToPageTarget = vi.fn()
    const target = renderTarget({
      scrollToPageTarget,
      getViewportElement: () => null,
    })

    target.scrollTo?.(makeSource({ kind: "csv_cell", row: 1, column: "A" }), {
      behavior: "auto",
    })
    expect(scrollToPageTarget).not.toHaveBeenCalled()
  })

  it("is a no-op when the viewer ref is empty", () => {
    const target = renderTarget(null)
    expect(() =>
      target.scrollTo?.(makeSource(pdfBbox()), { behavior: "auto" })
    ).not.toThrow()
  })
})

describe("renderPdfSourceOverlay", () => {
  function overlayMarkup(
    source: Source | undefined,
    pageNumber: number
  ): string {
    const Overlay = renderPdfSourceOverlay(source)
    const { container } = render(
      <Overlay
        pageNumber={pageNumber}
        width={100}
        height={200}
        scale={1}
        rotation={0}
      />
    )
    return container.innerHTML
  }

  it("renders nothing when there is no active source", () => {
    expect(overlayMarkup(undefined, 1)).toBe("")
  })

  it("renders a highlight only on the source's page", () => {
    const source: Source = { content: "x", anchor: pdfBbox({ page: 2 }) }
    expect(overlayMarkup(source, 1)).toBe("")
    expect(overlayMarkup(source, 2)).not.toBe("")
  })

  it("renders nothing for a source whose anchor has no pdf location", () => {
    const source: Source = {
      content: "x",
      anchor: { kind: "text_span", line_start: 1, line_end: 1 },
    }
    expect(overlayMarkup(source, 1)).toBe("")
  })
})
