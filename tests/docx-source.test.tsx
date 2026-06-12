// @vitest-environment jsdom

// Tests for the docx source adapter (registry/new-york-v4/ui/docx-source.tsx),
// which had no dedicated coverage. It turns a backend `Source` anchor into the
// viewer-ready `DocxTarget`, validating indices/ranges defensively. These probe
// the validation boundaries (negative/float indices, partial/inverted char
// ranges, empty content) plus the imperative scroll hook.

import * as React from "react"
import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import type { Source, SourceAnchor } from "@/lib/document-source"
import {
  docxSourceToTarget,
  sourceToDocxHighlight,
  useDocxSourceTarget,
} from "@/registry/new-york-v4/ui/docx-source"
import type { DocxViewerHandle } from "@/registry/new-york-v4/ui/docx-viewer"

afterEach(() => {
  cleanup()
})

function source(anchor: SourceAnchor, content = "Quarterly revenue increased"): Source {
  return { content, anchor }
}

function textSpan(
  overrides: Partial<Omit<SourceAnchor & { kind: "docx_text_span" }, "kind">> = {}
): SourceAnchor {
  return { kind: "docx_text_span", paragraph: 3, ...overrides }
}

function tableCell(
  overrides: Partial<Omit<SourceAnchor & { kind: "docx_table_cell" }, "kind">> = {}
): SourceAnchor {
  return { kind: "docx_table_cell", table: 0, row: 1, column: 2, ...overrides }
}

describe("docxSourceToTarget — non-docx and missing sources", () => {
  it("returns null for an undefined source", () => {
    expect(docxSourceToTarget(undefined)).toBeNull()
  })

  it("returns null for non-docx anchors", () => {
    const anchors: SourceAnchor[] = [
      { kind: "pdf_bbox", page: 1, left: 0, top: 0, width: 0.5, height: 0.5 },
      { kind: "image_bbox", left: 0, top: 0, width: 0.5, height: 0.5 },
      { kind: "csv_cell", row: 1, column: "A" },
      { kind: "spreadsheet_cell", row: 1, column: "A", sheet_index: 0 },
      { kind: "text_span", line_start: 1, line_end: 2 },
    ]
    for (const anchor of anchors) {
      expect(docxSourceToTarget(source(anchor))).toBeNull()
    }
  })
})

describe("docxSourceToTarget — docx_text_span", () => {
  it("resolves a valid text span to a trimmed text target", () => {
    expect(
      docxSourceToTarget(source(textSpan(), "  Quarterly revenue increased  "))
    ).toEqual({ kind: "text", text: "Quarterly revenue increased" })
  })

  it("accepts paragraph index 0", () => {
    expect(docxSourceToTarget(source(textSpan({ paragraph: 0 })))).toEqual({
      kind: "text",
      text: "Quarterly revenue increased",
    })
  })

  it("returns null when the quoted content is empty or whitespace-only", () => {
    expect(docxSourceToTarget(source(textSpan(), ""))).toBeNull()
    expect(docxSourceToTarget(source(textSpan(), "   \n\t "))).toBeNull()
  })

  it("rejects a negative or non-integer paragraph index", () => {
    expect(docxSourceToTarget(source(textSpan({ paragraph: -1 })))).toBeNull()
    expect(docxSourceToTarget(source(textSpan({ paragraph: 1.5 })))).toBeNull()
    expect(
      docxSourceToTarget(source(textSpan({ paragraph: Number.NaN })))
    ).toBeNull()
  })

  it("accepts a valid char range and an equal start/end range", () => {
    expect(
      docxSourceToTarget(source(textSpan({ char_start: 0, char_end: 10 })))
    ).toEqual({ kind: "text", text: "Quarterly revenue increased" })
    expect(
      docxSourceToTarget(source(textSpan({ char_start: 5, char_end: 5 })))
    ).toEqual({ kind: "text", text: "Quarterly revenue increased" })
  })

  it("accepts a span with no char range", () => {
    expect(docxSourceToTarget(source(textSpan({})))).toEqual({
      kind: "text",
      text: "Quarterly revenue increased",
    })
  })

  it("rejects a partial char range (only one bound present)", () => {
    expect(
      docxSourceToTarget(source(textSpan({ char_start: 3 })))
    ).toBeNull()
    expect(docxSourceToTarget(source(textSpan({ char_end: 3 })))).toBeNull()
  })

  it("rejects an inverted or negative char range", () => {
    expect(
      docxSourceToTarget(source(textSpan({ char_start: 8, char_end: 4 })))
    ).toBeNull()
    expect(
      docxSourceToTarget(source(textSpan({ char_start: -1, char_end: 4 })))
    ).toBeNull()
    expect(
      docxSourceToTarget(source(textSpan({ char_start: 1.5, char_end: 4 })))
    ).toBeNull()
  })
})

describe("docxSourceToTarget — docx_table_cell", () => {
  it("resolves a valid table cell to a cell target", () => {
    expect(docxSourceToTarget(source(tableCell()))).toEqual({
      kind: "cell",
      table: 0,
      row: 1,
      column: 2,
    })
  })

  it("resolves a cell target regardless of content (cells locate by index)", () => {
    expect(docxSourceToTarget(source(tableCell(), ""))).toEqual({
      kind: "cell",
      table: 0,
      row: 1,
      column: 2,
    })
  })

  it("rejects negative or non-integer table/row/column indices", () => {
    expect(docxSourceToTarget(source(tableCell({ table: -1 })))).toBeNull()
    expect(docxSourceToTarget(source(tableCell({ row: -1 })))).toBeNull()
    expect(docxSourceToTarget(source(tableCell({ column: -1 })))).toBeNull()
    expect(docxSourceToTarget(source(tableCell({ column: 1.5 })))).toBeNull()
    expect(
      docxSourceToTarget(source(tableCell({ table: Number.NaN })))
    ).toBeNull()
  })

  it("rejects an invalid char range on a cell anchor", () => {
    expect(
      docxSourceToTarget(source(tableCell({ char_start: 5, char_end: 1 })))
    ).toBeNull()
    expect(
      docxSourceToTarget(source(tableCell({ char_start: 5 })))
    ).toBeNull()
  })
})

describe("sourceToDocxHighlight", () => {
  it("matches docxSourceToTarget for text spans, cells, and non-docx anchors", () => {
    const text = source(textSpan())
    const cell = source(tableCell())
    const csv = source({ kind: "csv_cell", row: 1, column: "A" })
    expect(sourceToDocxHighlight(text)).toEqual(docxSourceToTarget(text))
    expect(sourceToDocxHighlight(cell)).toEqual(docxSourceToTarget(cell))
    expect(sourceToDocxHighlight(csv)).toBeNull()
    expect(sourceToDocxHighlight(undefined)).toBeNull()
  })
})

describe("useDocxSourceTarget", () => {
  function renderTarget(handle: DocxViewerHandle | null) {
    const ref = { current: handle } as React.RefObject<DocxViewerHandle | null>
    let target!: ReturnType<typeof useDocxSourceTarget>
    function Harness() {
      target = useDocxSourceTarget(ref)
      return null
    }
    const view = render(<Harness />)
    return { target, ref, view }
  }

  function handle(scrollToTarget = vi.fn()): DocxViewerHandle {
    return { scrollToTarget, getViewportElement: () => null }
  }

  it("forwards a resolved docx target and options to the viewer handle", () => {
    const scrollToTarget = vi.fn()
    const { target } = renderTarget(handle(scrollToTarget))

    target.scrollTo?.(source(tableCell({ table: 1, row: 2, column: 3 })), {
      behavior: "auto",
    })

    expect(scrollToTarget).toHaveBeenCalledWith(
      { kind: "cell", table: 1, row: 2, column: 3 },
      { behavior: "auto" }
    )
  })

  it("forwards a resolved text target", () => {
    const scrollToTarget = vi.fn()
    const { target } = renderTarget(handle(scrollToTarget))

    target.scrollTo?.(source(textSpan(), "Find me"), { behavior: "smooth" })

    expect(scrollToTarget).toHaveBeenCalledWith(
      { kind: "text", text: "Find me" },
      { behavior: "smooth" }
    )
  })

  it("does not call the handle for a non-docx anchor", () => {
    const scrollToTarget = vi.fn()
    const { target } = renderTarget(handle(scrollToTarget))

    target.scrollTo?.(source({ kind: "csv_cell", row: 1, column: "A" }), {
      behavior: "auto",
    })

    expect(scrollToTarget).not.toHaveBeenCalled()
  })

  it("does not call the handle for a text span with empty content", () => {
    const scrollToTarget = vi.fn()
    const { target } = renderTarget(handle(scrollToTarget))

    target.scrollTo?.(source(textSpan(), "   "), { behavior: "auto" })

    expect(scrollToTarget).not.toHaveBeenCalled()
  })

  it("is a no-op when the viewer ref is empty", () => {
    const { target } = renderTarget(null)
    expect(() =>
      target.scrollTo?.(source(tableCell()), { behavior: "auto" })
    ).not.toThrow()
  })

  it("returns a stable target object across re-renders for the same ref", () => {
    const ref = { current: handle() } as React.RefObject<DocxViewerHandle | null>
    const seen: ReturnType<typeof useDocxSourceTarget>[] = []
    function Harness() {
      seen.push(useDocxSourceTarget(ref))
      return null
    }
    const view = render(<Harness />)
    view.rerender(<Harness />)

    expect(seen).toHaveLength(2)
    expect(seen[0]).toBe(seen[1])
  })
})
