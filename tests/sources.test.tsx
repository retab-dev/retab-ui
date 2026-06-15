// @vitest-environment jsdom

import * as React from "react"
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import type { Source, SourceAnchor, SourceMap } from "@/lib/document-source"
import { useSegmentedSourceFieldLink } from "@/components/ui/source-field-link"
import {
  createSegmentedDocumentModel,
  type SegmentedDocumentModel,
} from "@/components/ui/segmented-document-model"
import {
  SegmentedDocumentProvider,
  useSegmentedDocumentViewport,
} from "@/components/ui/segmented-document-provider"
import { useSegmentedPdfSourceOverlay } from "@/components/ui/source-segmented-document-overlays"
import {
  sourceFieldsToSegmentedDocumentModel,
  sourceMapToSegmentedDocumentModel,
  sourceToSegmentAnchor,
} from "@/components/ui/source-segmented-document-model"
import csvSample from "@/components/viewers/sample-data/csv-sources.json"
import docxSample from "@/components/viewers/sample-data/docx-sources.json"
import imageSample from "@/components/viewers/sample-data/image-sources.json"
import jsonFormSourcesSample from "@/components/viewers/sample-data/json-form-sources.json"
import textSample from "@/components/viewers/sample-data/text-sources.json"
import xlsxSample from "@/components/viewers/sample-data/xlsx-sources.json"
import {
  extractionSourcesToSourceMap,
  sourceLocationKey,
} from "@/registry/new-york-v4/lib/document-source"
import { evidenceToAnchoredItem } from "@/registry/new-york-v4/ui/anchored-evidence"
import {
  columnLetterToIndex,
  csvAnchorToTarget,
  sourceToCsvCell,
  useCsvSourceTarget,
} from "@/registry/new-york-v4/ui/csv-source"
import type { CsvViewerHandle } from "@/registry/new-york-v4/ui/csv-viewer"
import {
  docxAnchorToTarget,
  sourceToDocxHighlight,
  useDocxSourceTarget,
} from "@/registry/new-york-v4/ui/docx-source"
import type { DocxViewerHandle } from "@/registry/new-york-v4/ui/docx-viewer"
import {
  imageAnchorToTarget,
  renderImageSourceOverlay,
  rotateImageArea,
  useImageSourceTarget,
} from "@/registry/new-york-v4/ui/image-source"
import type { ImageViewerHandle } from "@/registry/new-york-v4/ui/image-viewer-types"
import {
  pdfAnchorToTarget,
  renderPdfSourceOverlay,
  usePdfSourceTarget,
} from "@/registry/new-york-v4/ui/pdf-source"
import type { PdfViewerHandle } from "@/registry/new-york-v4/ui/pdf-viewer"
import { sourceToDocumentAnchor } from "@/registry/new-york-v4/ui/source-anchor"
import {
  sourceFieldsToEvidenceModel,
  sourceMapToEvidenceModel,
  sourceToDocumentAnchor as sourceToEvidenceAnchor,
} from "@/registry/new-york-v4/ui/source-evidence"
import { SourceFieldList } from "@/registry/new-york-v4/ui/source-field-list"
import { SourceIndicator } from "@/registry/new-york-v4/ui/source-indicator"
import {
  sourceToTextHighlight,
  textAnchorToTarget,
  useTextSourceTarget,
} from "@/registry/new-york-v4/ui/text-source"
import type { TextViewerHandle } from "@/registry/new-york-v4/ui/text-viewer"
import {
  sourceToXlsxCell,
  spreadsheetColumnToIndex,
  useXlsxSourceTarget,
  xlsxAnchorToTarget,
} from "@/registry/new-york-v4/ui/xlsx-source"
import type { XlsxViewerHandle } from "@/registry/new-york-v4/ui/xlsx-viewer"

vi.mock("@/components/ui/pdf-viewer", () => ({
  PdfHighlight: ({
    area,
  }: {
    area: { left: number; top: number; width: number; height: number }
  }) => (
    <div
      data-testid="pdf-highlight"
      style={{
        left: `${area.left}%`,
        top: `${area.top}%`,
        width: `${area.width}%`,
        height: `${area.height}%`,
      }}
    />
  ),
}))

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

function source(anchor: SourceAnchor, content = "quoted content"): Source {
  return { content, anchor }
}

const pdfSource = source({
  kind: "pdf_bbox",
  page: 3,
  left: 0.1,
  top: 0.2,
  width: 0.3,
  height: 0.4,
})

const imageSource = source({
  kind: "image_bbox",
  page: 2,
  left: 0.15,
  top: 0.25,
  width: 0.35,
  height: 0.45,
})

const csvSource = source({
  kind: "csv_cell",
  row: 4,
  column: "AA",
  coordinate: "AA4",
})

const xlsxSource = source({
  kind: "spreadsheet_cell",
  sheet_index: 2,
  sheet_name: "FY 2024",
  row: 8,
  column: "AZ",
  coordinate: "AZ8",
})

const textSource = source({
  kind: "text_span",
  line_start: 12,
  line_end: 14,
})

const docxTextSource = source(
  {
    kind: "docx_text_span",
    paragraph: 6,
    char_start: 3,
    char_end: 18,
  },
  "ACME Corp"
)

const docxCellSource = source({
  kind: "docx_table_cell",
  table: 1,
  row: 2,
  column: 3,
})

const oversizedColumn = "A".repeat(1000)

interface SampleSourceField {
  key: string
  label: string
  value: unknown
  source: Source
}

const sourceFieldSamples = [
  { name: "csv", fields: csvSample as SampleSourceField[] },
  { name: "docx", fields: docxSample as SampleSourceField[] },
  { name: "image", fields: imageSample as SampleSourceField[] },
  { name: "text", fields: textSample as SampleSourceField[] },
  { name: "xlsx", fields: xlsxSample as SampleSourceField[] },
]

function SegmentedFieldLinkProbe({
  initialPath,
}: {
  initialPath: string | null
}) {
  const link = useSegmentedSourceFieldLink({ initialPath })

  return (
    <output
      data-testid="segmented-link-probe"
      data-active-anchor={link.activeAnchor ? "true" : "false"}
      data-active-anchor-count={link.activeAnchors.length}
    >
      {link.activePath ?? "none"}
    </output>
  )
}

function SegmentedPdfOverlayProbe({ initialPath }: { initialPath: string }) {
  const link = useSegmentedSourceFieldLink({ initialPath })
  const renderOverlay = useSegmentedPdfSourceOverlay(link)

  return (
    <div
      data-testid="segmented-pdf-overlay-probe"
      data-active-anchor-count={link.activeAnchors.length}
    >
      {renderOverlay({
        pageNumber: 2,
        width: 600,
        height: 800,
        scale: 1,
        rotation: 0,
      })}
    </div>
  )
}

function SegmentedFieldLinkNavigationProbe({
  onScroll,
}: {
  onScroll: (
    target: {
      pageNumber: number
      top: number
      left?: number
      width?: number
      height?: number
    },
    options?: ScrollToOptions
  ) => void
}) {
  const link = useSegmentedSourceFieldLink()
  const viewport = useSegmentedDocumentViewport()

  React.useEffect(() => {
    viewport.documentHandlers.setDocumentHandle({
      scrollToPage: () => {},
      scrollToPageArea: onScroll,
    })

    return () => viewport.documentHandlers.setDocumentHandle(null)
  }, [onScroll, viewport.documentHandlers])

  return (
    <>
      <button
        type="button"
        onMouseEnter={() => link.onFieldHover("logo")}
        onClick={() => link.selectField?.("logo")}
      >
        logo source
      </button>
      <output
        data-testid="segmented-navigation-probe"
        data-active-anchor={link.activeAnchor ? "true" : "false"}
        data-active-anchor-count={link.activeAnchors.length}
      >
        {link.activePath ?? "none"}
      </output>
    </>
  )
}

function expectSourceToResolve(source: Source) {
  switch (source.anchor.kind) {
    case "pdf_bbox":
      expect(pdfAnchorToTarget(source.anchor)).toBeDefined()
      expect(imageAnchorToTarget(source.anchor)).toBeDefined()
      return
    case "image_bbox":
      expect(imageAnchorToTarget(source.anchor)).toBeDefined()
      return
    case "csv_cell":
      expect(csvAnchorToTarget(source.anchor)).not.toBeNull()
      return
    case "spreadsheet_cell":
      expect(xlsxAnchorToTarget(source.anchor)).toBeDefined()
      return
    case "docx_text_span":
    case "docx_table_cell":
      expect(docxAnchorToTarget(source.anchor, source)).not.toBeNull()
      return
    case "text_span":
      expect(textAnchorToTarget(source.anchor)).toBeDefined()
      return
  }
}

describe("document source model", () => {
  it("flattens nested source trees into dotted and indexed field paths", () => {
    expect(
      extractionSourcesToSourceMap({
        owner: {
          name: { value: "ACME", source: pdfSource },
          email: { value: "missing", source: null },
        },
        line_items: [
          { amount: { value: 1200, source: csvSource } },
          { amount: { value: 900, source: xlsxSource } },
        ],
      })
    ).toEqual({
      "owner.name": pdfSource,
      "line_items.0.amount": csvSource,
      "line_items.1.amount": xlsxSource,
    })
  })

  it("supports a root scalar source with the empty path key", () => {
    expect(
      extractionSourcesToSourceMap({ value: "standalone", source: textSource })
    ).toEqual({ "": textSource })
  })

  it("descends through unsourced value wrappers around nested objects", () => {
    expect(
      extractionSourcesToSourceMap({
        value: {
          owner: {
            value: {
              name: { value: "ACME", source: pdfSource },
            },
            source: null,
          },
          items: {
            value: [{ amount: { value: 12, source: csvSource } }],
            source: null,
          },
        },
        source: null,
      })
    ).toEqual({
      "owner.name": pdfSource,
      "items.0.amount": csvSource,
    })
  })

  it("does not mistake schema fields named value and source for a source wrapper", () => {
    expect(
      extractionSourcesToSourceMap({
        value: { value: "display value", source: pdfSource },
        source: { value: "upstream system", source: csvSource },
        metadata: {
          value: { value: "nested value", source: textSource },
          source: { value: "nested system", source: docxTextSource },
        },
      })
    ).toEqual({
      value: pdfSource,
      source: csvSource,
      "metadata.value": textSource,
      "metadata.source": docxTextSource,
    })
  })

  it("skips malformed source leaves instead of leaking invalid runtime sources", () => {
    expect(
      extractionSourcesToSourceMap({
        valid: { value: "ok", source: pdfSource },
        missing_content: {
          value: "bad",
          source: { anchor: pdfSource.anchor },
        },
        missing_anchor: {
          value: "bad",
          source: { content: "bad" },
        },
        unknown_anchor: {
          value: "bad",
          source: {
            content: "bad",
            anchor: { kind: "unknown_anchor" },
          },
        },
        primitive_source: {
          value: "bad",
          source: "not a source",
        },
      })
    ).toEqual({
      valid: pdfSource,
    })
  })

  it("skips source leaves with invalid known anchor payloads", () => {
    expect(
      extractionSourcesToSourceMap({
        valid_pdf: { value: "ok", source: pdfSource },
        pdf_missing_page: {
          value: "bad",
          source: {
            content: "bad",
            anchor: {
              kind: "pdf_bbox",
              left: 0.1,
              top: 0.1,
              width: 0.2,
              height: 0.2,
            },
          },
        },
        image_bad_frame: {
          value: "bad",
          source: {
            content: "bad",
            anchor: {
              kind: "image_bbox",
              page: 0,
              left: 0.1,
              top: 0.1,
              width: 0.2,
              height: 0.2,
            },
          },
        },
        csv_bad_column: {
          value: "bad",
          source: {
            content: "bad",
            anchor: { kind: "csv_cell", row: 1, column: "A1" },
          },
        },
        csv_oversized_column: {
          value: "bad",
          source: {
            content: "bad",
            anchor: { kind: "csv_cell", row: 1, column: oversizedColumn },
          },
        },
        xlsx_bad_sheet: {
          value: "bad",
          source: {
            content: "bad",
            anchor: {
              kind: "spreadsheet_cell",
              sheet_index: -1,
              row: 1,
              column: "A",
            },
          },
        },
        docx_bad_span: {
          value: "bad",
          source: {
            content: "bad",
            anchor: { kind: "docx_text_span", paragraph: -1 },
          },
        },
        text_bad_range: {
          value: "bad",
          source: {
            content: "bad",
            anchor: { kind: "text_span", line_start: 2, line_end: 1 },
          },
        },
      })
    ).toEqual({
      valid_pdf: pdfSource,
    })
  })

  it("builds stable location keys from the full page and box geometry", () => {
    expect(
      sourceLocationKey({
        page: 2,
        area: { left: 10, top: 20, width: 30, height: 40 },
      })
    ).toBe("2:10:20:30:40")
    expect(sourceLocationKey(undefined)).toBeNull()
  })
})

describe("source evidence projection", () => {
  it("converts sources to document anchors without viewer adapters", () => {
    expect(sourceToDocumentAnchor(pdfSource)).toEqual({
      kind: "pdf-area",
      pageNumber: 3,
      left: 10,
      top: 20,
      width: 30,
      height: 40,
    })
    expect(sourceToDocumentAnchor(imageSource)).toEqual({
      kind: "image-area",
      frameNumber: 2,
      left: 15,
      top: 25,
      width: 35,
      height: 45,
    })
    expect(
      sourceToDocumentAnchor(source({ kind: "csv_cell", row: -1, column: "A" }))
    ).toBeNull()
  })

  it("projects every source adapter kind to a document anchor", () => {
    expect(sourceToEvidenceAnchor(pdfSource)).toEqual({
      status: "resolved",
      anchor: {
        kind: "pdf-area",
        pageNumber: 3,
        left: 10,
        top: 20,
        width: 30,
        height: 40,
      },
    })
    expect(sourceToEvidenceAnchor(imageSource)).toEqual({
      status: "resolved",
      anchor: {
        kind: "image-area",
        frameNumber: 2,
        left: 15,
        top: 25,
        width: 35,
        height: 45,
      },
    })
    expect(sourceToEvidenceAnchor(csvSource)).toEqual({
      status: "resolved",
      anchor: { kind: "csv-cell", rowIndex: 3, columnIndex: 26 },
    })
    expect(sourceToEvidenceAnchor(xlsxSource)).toEqual({
      status: "resolved",
      anchor: {
        kind: "xlsx-cell",
        sheetIndex: 2,
        rowIndex: 7,
        columnIndex: 51,
      },
    })
    expect(sourceToEvidenceAnchor(textSource)).toEqual({
      status: "resolved",
      anchor: { kind: "text-range", startLine: 12, endLine: 14 },
    })
    expect(sourceToEvidenceAnchor(docxCellSource)).toEqual({
      status: "resolved",
      anchor: {
        kind: "docx-target",
        target: { kind: "cell", table: 1, row: 2, column: 3 },
      },
    })
  })

  it("keeps missing and invalid anchors distinct before provider projection", () => {
    const missing = sourceToEvidenceAnchor(null)
    const invalid = sourceToEvidenceAnchor(
      source({ kind: "csv_cell", row: -1, column: "A" })
    )

    expect(missing).toEqual({ status: "missing" })
    expect(invalid).toEqual({
      status: "invalid",
      reason: "Unsupported or invalid csv_cell",
    })
    expect(
      evidenceToAnchoredItem({
        id: "missing",
        anchor: missing,
      })
    ).toEqual({
      id: "missing",
      anchor: null,
      disabled: false,
    })
    expect(
      evidenceToAnchoredItem({
        id: "invalid",
        anchor: invalid,
      })
    ).toEqual({
      id: "invalid",
      anchor: null,
      disabled: true,
    })
  })

  it("projects source fields to evidence rows and provider items", () => {
    const model = sourceFieldsToEvidenceModel([
      {
        key: "invoice.total",
        label: "Total",
        value: "$120.00",
        hint: "Page 3",
        source: pdfSource,
      },
      {
        key: "approver",
        label: "Approver",
        value: "Morgan Lee",
        source: null,
      },
    ])

    expect(model.evidenceItems).toMatchObject([
      {
        id: "invoice.total",
        payload: {
          label: "Total",
          value: "$120.00",
          hint: "Page 3",
          sourceKind: "pdf_bbox",
        },
        anchor: { status: "resolved" },
      },
      {
        id: "approver",
        payload: {
          label: "Approver",
          value: "Morgan Lee",
          sourceKind: null,
        },
        anchor: { status: "missing" },
      },
    ])
    expect(model.anchoredItems).toEqual([
      {
        id: "invoice.total",
        anchor: {
          kind: "pdf-area",
          pageNumber: 3,
          left: 10,
          top: 20,
          width: 30,
          height: 40,
        },
        disabled: false,
      },
      { id: "approver", anchor: null, disabled: false },
    ])
  })

  it("projects source maps with dotted and indexed paths without changing ids", () => {
    const model = sourceMapToEvidenceModel({
      sourceMap: {
        "owner.name": pdfSource,
        "line_items.0.amount": csvSource,
      },
      values: {
        owner: { name: "ACME" },
        line_items: [{ amount: 1200 }],
      },
      schema: {
        type: "object",
        properties: {
          owner: { title: "Owner", type: "object" },
        },
      },
    })

    expect(model.evidenceItems.map((item) => item.id)).toEqual([
      "owner.name",
      "line_items.0.amount",
    ])
    expect(model.evidenceItems.map((item) => item.payload.value)).toEqual([
      "ACME",
      1200,
    ])
    expect(model.evidenceItems.map((item) => item.payload.label)).toEqual([
      "owner.name",
      "line_items.0.amount",
    ])
    expect(model.anchoredItems.map((item) => item.id)).toEqual([
      "owner.name",
      "line_items.0.amount",
    ])
  })

  it("projects page-local sources to segmented document segments and anchors", () => {
    const model = sourceFieldsToSegmentedDocumentModel([
      {
        id: "invoice.total",
        label: "Total",
        source: pdfSource,
      },
      {
        id: "logo",
        label: "Logo",
        source: imageSource,
      },
      {
        id: "line_items.0.amount",
        label: "Amount",
        source: csvSource,
      },
    ])

    expect(model.segments).toMatchObject([
      {
        id: "source:invoice.total:0",
        label: "Total",
        pages: [3],
        sourceId: "invoice.total",
      },
      {
        id: "source:logo:1",
        label: "Logo",
        pages: [2],
        sourceId: "logo",
      },
      {
        id: "source:line_items.0.amount:2",
        label: "Amount",
        pages: [],
        sourceId: "line_items.0.amount",
      },
    ])
    expect(model.anchors).toEqual([
      {
        id: "source:invoice.total:0:anchor",
        segmentId: "source:invoice.total:0",
        pageNumber: 3,
        bounds: { x: 0.1, y: 0.2, width: 0.3, height: 0.4 },
      },
      {
        id: "source:logo:1:anchor",
        segmentId: "source:logo:1",
        pageNumber: 2,
        bounds: { x: 0.15, y: 0.25, width: 0.35, height: 0.45 },
      },
    ])
    expect(model.pages.map((page) => page.pageNumber)).toEqual([1, 2, 3])
  })

  it("keeps invalid and non-page-local source anchors out of segmented anchors", () => {
    for (const [label, nonPageSource] of [
      ["csv", csvSource],
      ["xlsx", xlsxSource],
      ["text", textSource],
      ["docx-text", docxTextSource],
      ["docx-cell", docxCellSource],
    ] as const) {
      expect(sourceToSegmentAnchor(nonPageSource, label)).toBeNull()
    }
    expect(
      sourceToSegmentAnchor(
        source({
          kind: "pdf_bbox",
          page: 0,
          left: 0.1,
          top: 0.2,
          width: 0.3,
          height: 0.4,
        }),
        "bad-pdf"
      )
    ).toBeNull()

    const model = sourceMapToSegmentedDocumentModel({
      labels: { "": "Root value" },
      sourceMap: {
        "": pdfSource,
        amount: csvSource,
      },
    })

    expect(model.segments.map((segment) => segment.label)).toEqual([
      "Root value",
      "amount",
    ])
    expect(model.anchors).toHaveLength(1)
  })

  it("activates an initial segmented source path with its page anchor", async () => {
    const sourceMap = extractionSourcesToSourceMap(
      jsonFormSourcesSample.sources
    )
    const model = sourceMapToSegmentedDocumentModel({
      sourceMap,
    })

    render(
      <SegmentedDocumentProvider model={model}>
        <SegmentedFieldLinkProbe initialPath="statement_date" />
      </SegmentedDocumentProvider>
    )

    await waitFor(() => {
      const probe = screen.getByTestId("segmented-link-probe")
      expect(probe.textContent).toBe("statement_date")
      expect(probe.getAttribute("data-active-anchor")).toBe("true")
      expect(probe.getAttribute("data-active-anchor-count")).toBe("1")
    })
  })

  it("keeps every segmented source anchor active for one selected field", async () => {
    const model: SegmentedDocumentModel = createSegmentedDocumentModel({
      pageCount: 2,
      segments: [
        {
          id: "amount",
          sourceId: "invoice.amount",
          label: "Amount",
          pages: [2],
          color: "#4E79A7",
          index: 0,
        },
      ],
      anchors: [
        {
          id: "amount-label",
          segmentId: "amount",
          pageNumber: 2,
          bounds: { x: 0.1, y: 0.2, width: 0.3, height: 0.04 },
        },
        {
          id: "amount-value",
          segmentId: "amount",
          pageNumber: 2,
          bounds: { x: 0.55, y: 0.2, width: 0.2, height: 0.04 },
        },
      ],
    })

    render(
      <SegmentedDocumentProvider model={model}>
        <SegmentedPdfOverlayProbe initialPath="invoice.amount" />
      </SegmentedDocumentProvider>
    )

    await waitFor(() => {
      const probe = screen.getByTestId("segmented-pdf-overlay-probe")
      expect(probe.getAttribute("data-active-anchor-count")).toBe("2")
      expect(screen.getAllByTestId("pdf-highlight")).toHaveLength(2)
    })
  })

  it("keeps segmented hover active while navigating to the source", async () => {
    const model = sourceFieldsToSegmentedDocumentModel([
      {
        id: "logo",
        label: "Logo",
        source: imageSource,
      },
    ])
    const scrollToPageArea = vi.fn()

    render(
      <SegmentedDocumentProvider model={model}>
        <SegmentedFieldLinkNavigationProbe onScroll={scrollToPageArea} />
      </SegmentedDocumentProvider>
    )

    fireEvent.mouseEnter(screen.getByRole("button", { name: "logo source" }))

    await waitFor(() => {
      const probe = screen.getByTestId("segmented-navigation-probe")
      expect(probe.textContent).toBe("logo")
      expect(probe.getAttribute("data-active-anchor")).toBe("true")
    })
    expect(scrollToPageArea).toHaveBeenLastCalledWith(
      { pageNumber: 2, left: 15, top: 25, width: 35, height: 45 },
      { behavior: "auto" }
    )

    fireEvent.click(screen.getByRole("button", { name: "logo source" }))

    expect(scrollToPageArea).toHaveBeenLastCalledWith(
      { pageNumber: 2, left: 15, top: 25, width: 35, height: 45 },
      { behavior: "smooth" }
    )
  })
})

describe("source sample fixtures", () => {
  it("keeps every source-block sample keyed uniquely and adapter-resolvable", () => {
    for (const sample of sourceFieldSamples) {
      const keys = sample.fields.map((field) => field.key)
      expect(new Set(keys).size, `${sample.name} duplicate keys`).toBe(
        keys.length
      )

      for (const field of sample.fields) {
        expect(field.key, `${sample.name} empty key`).not.toBe("")
        expect(
          field.label,
          `${sample.name}.${field.key} missing label`
        ).not.toBe("")
        expect(
          field.source.content,
          `${sample.name}.${field.key} missing source content`
        ).not.toBe("")
        expect(
          extractionSourcesToSourceMap({
            [field.key]: { value: field.value, source: field.source },
          }),
          `${sample.name}.${field.key} invalid source shape`
        ).toEqual({ [field.key]: field.source })
        expectSourceToResolve(field.source)
      }
    }
  })

  it("keeps the JSON-form sample flattened to resolvable PDF sources", () => {
    const response = jsonFormSourcesSample as {
      document_type: string
      file: { filename?: string }
      sources: unknown
    }

    expect(response.document_type).toBe("pdf")
    expect(response.file.filename).toBe("jane-doe-bank-statement-5-pages.pdf")

    const sourceMap = extractionSourcesToSourceMap(response.sources)
    const paths = Object.keys(sourceMap)
    expect(paths).toHaveLength(392)
    expect(paths.slice(0, 5)).toEqual([
      "account_number",
      "statement_date",
      "transactions.0.date",
      "transactions.0.description",
      "transactions.0.amount",
    ])
    expect(paths.slice(-3)).toEqual([
      "transactions.129.date",
      "transactions.129.description",
      "transactions.129.amount",
    ])

    for (const [path, mappedSource] of Object.entries(sourceMap)) {
      expect(
        mappedSource.anchor.kind,
        `${path} should stay backed by a PDF bbox`
      ).toBe("pdf_bbox")
      expectSourceToResolve(mappedSource)
    }
  })
})

describe("source adapters", () => {
  it("converts PDF and image anchors into viewer percentage regions", () => {
    expect(pdfAnchorToTarget(pdfSource.anchor)).toEqual({
      page: 3,
      area: { left: 10, top: 20, width: 30, height: 40 },
    })
    expect(pdfAnchorToTarget(csvSource.anchor)).toBeUndefined()

    expect(imageAnchorToTarget(imageSource.anchor)).toEqual({
      frame: 2,
      area: {
        left: 15,
        top: 25,
        width: 35,
        height: 45,
      },
    })
    expect(
      imageAnchorToTarget(
        source({
          kind: "image_bbox",
          left: 0,
          top: 0,
          width: 1,
          height: 1,
        }).anchor
      )?.frame
    ).toBe(1)
  })

  it("rejects invalid PDF and image geometry instead of rendering impossible boxes", () => {
    expect(
      pdfAnchorToTarget({
        kind: "pdf_bbox",
        page: 0,
        left: 0.1,
        top: 0.1,
        width: 0.2,
        height: 0.2,
      })
    ).toBeUndefined()
    expect(
      pdfAnchorToTarget({
        kind: "pdf_bbox",
        page: 1,
        left: -0.1,
        top: 0.1,
        width: 0.2,
        height: 0.2,
      })
    ).toBeUndefined()
    expect(
      imageAnchorToTarget({
        kind: "image_bbox",
        left: 0.1,
        top: 0.1,
        width: 0,
        height: 0.2,
      })
    ).toBeUndefined()
    expect(
      imageAnchorToTarget({
        kind: "image_bbox",
        left: 0.9,
        top: 0.1,
        width: 0.2,
        height: 0.2,
      })
    ).toBeUndefined()
    expect(
      imageAnchorToTarget({
        kind: "image_bbox",
        left: Number.NaN,
        top: 0.1,
        width: 0.2,
        height: 0.2,
      })
    ).toBeUndefined()
    expect(
      imageAnchorToTarget({
        kind: "image_bbox",
        page: 0,
        left: 0.1,
        top: 0.1,
        width: 0.2,
        height: 0.2,
      })
    ).toBeUndefined()
    expect(
      pdfAnchorToTarget({
        kind: "image_bbox",
        page: 0,
        left: 0.1,
        top: 0.1,
        width: 0.2,
        height: 0.2,
      })
    ).toBeUndefined()
  })

  it("rotates image source areas around the rendered frame", () => {
    const area = { left: 10, top: 20, width: 30, height: 40 }

    expect(rotateImageArea(area, 0)).toEqual(area)
    expect(rotateImageArea(area, 90)).toEqual({
      left: 40,
      top: 10,
      width: 40,
      height: 30,
    })
    expect(rotateImageArea(area, 180)).toEqual({
      left: 60,
      top: 40,
      width: 30,
      height: 40,
    })
    expect(rotateImageArea(area, 270)).toEqual({
      left: 20,
      top: 60,
      width: 40,
      height: 30,
    })
  })

  it("renders PDF and image overlays only on the anchored page or frame", () => {
    const pdfOverlay = renderPdfSourceOverlay(pdfSource)
    const { container, rerender } = render(
      <>
        {pdfOverlay({
          pageNumber: 2,
          width: 100,
          height: 100,
          scale: 1,
          rotation: 0,
        })}
      </>
    )
    expect(container.firstChild).toBeNull()

    rerender(
      <>
        {pdfOverlay({
          pageNumber: 3,
          width: 100,
          height: 100,
          scale: 1,
          rotation: 0,
        })}
      </>
    )
    expect((container.firstElementChild as HTMLElement).style.left).toBe("10%")
    expect((container.firstElementChild as HTMLElement).style.top).toBe("20%")
    expect((container.firstElementChild as HTMLElement).style.width).toBe("30%")
    expect((container.firstElementChild as HTMLElement).style.height).toBe(
      "40%"
    )

    const imageOverlay = renderImageSourceOverlay(imageSource)
    rerender(
      <>
        {imageOverlay({
          frameNumber: 1,
          width: 100,
          height: 100,
          scale: 1,
          rotation: 0,
        })}
      </>
    )
    expect(container.firstChild).toBeNull()

    rerender(
      <>
        {imageOverlay({
          frameNumber: 2,
          width: 100,
          height: 100,
          scale: 1,
          rotation: 90,
        })}
      </>
    )
    expect((container.firstElementChild as HTMLElement).style.left).toBe("30%")
    expect((container.firstElementChild as HTMLElement).style.top).toBe("15%")
    expect((container.firstElementChild as HTMLElement).style.width).toBe("45%")
    expect((container.firstElementChild as HTMLElement).style.height).toBe(
      "35%"
    )
  })

  it("converts CSV and spreadsheet columns to zero-based viewer cells", () => {
    expect(columnLetterToIndex("A")).toBe(0)
    expect(columnLetterToIndex("Z")).toBe(25)
    expect(columnLetterToIndex("AA")).toBe(26)
    expect(columnLetterToIndex("az")).toBe(51)

    expect(csvAnchorToTarget(csvSource.anchor)).toEqual({
      rowIndex: 3,
      columnIndex: 26,
    })
    expect(sourceToCsvCell(textSource)).toBeNull()

    expect(spreadsheetColumnToIndex("AZ")).toBe(51)
    expect(xlsxAnchorToTarget(xlsxSource.anchor)).toEqual({
      sheet: 2,
      row: 7,
      col: 51,
    })
    expect(sourceToXlsxCell(xlsxSource)).toEqual({ sheet: 2, row: 7, col: 51 })
    expect(sourceToXlsxCell(csvSource)).toBeNull()
  })

  it("rejects invalid CSV and spreadsheet coordinates instead of producing impossible viewer cells", () => {
    expect(columnLetterToIndex("")).toBeNull()
    expect(columnLetterToIndex("A1")).toBeNull()
    expect(columnLetterToIndex("a-z")).toBeNull()
    expect(columnLetterToIndex(oversizedColumn)).toBeNull()
    expect(spreadsheetColumnToIndex("")).toBeNull()
    expect(spreadsheetColumnToIndex("1")).toBeNull()
    expect(spreadsheetColumnToIndex(oversizedColumn)).toBeNull()

    expect(
      csvAnchorToTarget({
        kind: "csv_cell",
        row: 0,
        column: "A",
      })
    ).toBeNull()
    expect(
      csvAnchorToTarget({
        kind: "csv_cell",
        row: 1,
        column: "",
      })
    ).toBeNull()
    expect(
      csvAnchorToTarget({
        kind: "csv_cell",
        row: 1,
        column: oversizedColumn,
      })
    ).toBeNull()
    expect(
      xlsxAnchorToTarget({
        kind: "spreadsheet_cell",
        sheet_index: -1,
        row: 1,
        column: "A",
      })
    ).toBeUndefined()
    expect(
      xlsxAnchorToTarget({
        kind: "spreadsheet_cell",
        sheet_index: 0,
        row: 0,
        column: "A",
      })
    ).toBeUndefined()
    expect(
      xlsxAnchorToTarget({
        kind: "spreadsheet_cell",
        sheet_index: 0,
        row: 1,
        column: "A1",
      })
    ).toBeUndefined()
    expect(
      xlsxAnchorToTarget({
        kind: "spreadsheet_cell",
        sheet_index: 0,
        row: 1,
        column: oversizedColumn,
      })
    ).toBeUndefined()
  })

  it("converts text and docx anchors into viewer-native targets", () => {
    expect(textAnchorToTarget(textSource.anchor)).toEqual({
      start: 12,
      end: 14,
    })
    expect(sourceToTextHighlight(textSource)).toEqual({ start: 12, end: 14 })
    expect(sourceToTextHighlight(csvSource)).toBeNull()

    expect(docxAnchorToTarget(docxTextSource.anchor, docxTextSource)).toEqual({
      kind: "text",
      text: "ACME Corp",
    })
    expect(docxAnchorToTarget(docxCellSource.anchor, docxCellSource)).toEqual({
      kind: "cell",
      table: 1,
      row: 2,
      column: 3,
    })
    expect(sourceToDocxHighlight(csvSource)).toBeNull()
  })

  it("rejects invalid text spans instead of producing impossible line ranges", () => {
    expect(
      textAnchorToTarget({
        kind: "text_span",
        line_start: 0,
        line_end: 2,
      })
    ).toBeUndefined()
    expect(
      textAnchorToTarget({
        kind: "text_span",
        line_start: 3,
        line_end: 2,
      })
    ).toBeUndefined()
    expect(
      textAnchorToTarget({
        kind: "text_span",
        line_start: 1.5,
        line_end: 2,
      })
    ).toBeUndefined()
    expect(
      textAnchorToTarget({
        kind: "text_span",
        line_start: 1,
        line_end: 2,
        char_start: 4,
      })
    ).toBeUndefined()
    expect(
      textAnchorToTarget({
        kind: "text_span",
        line_start: 1,
        line_end: 2,
        char_start: 4,
        char_end: 2,
      })
    ).toBeUndefined()
  })

  it("rejects invalid docx anchors instead of producing impossible viewer targets", () => {
    const invalidSources = [
      source({ kind: "docx_table_cell", table: -1, row: 0, column: 0 }),
      source({ kind: "docx_table_cell", table: 0, row: 1.5, column: 0 }),
      source({
        kind: "docx_table_cell",
        table: 0,
        row: 0,
        column: 0,
        char_start: 4,
        char_end: 2,
      }),
      source(
        {
          kind: "docx_text_span",
          paragraph: 0,
          char_start: 0,
          char_end: 0,
        },
        "   "
      ),
      source({ kind: "docx_text_span", paragraph: -1 }, "ACME"),
      source({ kind: "docx_text_span", paragraph: 1.5 }, "ACME"),
      source(
        {
          kind: "docx_text_span",
          paragraph: 0,
          char_start: 4,
          char_end: 2,
        },
        "ACME"
      ),
    ]

    for (const invalidSource of invalidSources) {
      expect(docxAnchorToTarget(invalidSource.anchor, invalidSource)).toBeNull()
    }
  })

  it("bridges docx sources to the viewer imperative target", () => {
    const scrollToTarget = vi.fn()
    const { rerender } = render(
      <DocxSourceTargetHarness
        source={docxTextSource}
        onScroll={scrollToTarget}
      />
    )

    fireEvent.click(screen.getByRole("button", { name: "scroll docx source" }))
    expect(scrollToTarget).toHaveBeenCalledWith(
      { kind: "text", text: "ACME Corp" },
      { behavior: "smooth" }
    )

    rerender(
      <DocxSourceTargetHarness
        source={docxCellSource}
        onScroll={scrollToTarget}
      />
    )
    fireEvent.click(screen.getByRole("button", { name: "scroll docx source" }))
    expect(scrollToTarget).toHaveBeenLastCalledWith(
      { kind: "cell", table: 1, row: 2, column: 3 },
      { behavior: "smooth" }
    )

    scrollToTarget.mockClear()
    rerender(
      <DocxSourceTargetHarness source={csvSource} onScroll={scrollToTarget} />
    )
    fireEvent.click(screen.getByRole("button", { name: "scroll docx source" }))
    expect(scrollToTarget).not.toHaveBeenCalled()

    rerender(
      <DocxSourceTargetHarness
        source={source(
          {
            kind: "docx_text_span",
            paragraph: -1,
          },
          "ACME"
        )}
        onScroll={scrollToTarget}
      />
    )
    fireEvent.click(screen.getByRole("button", { name: "scroll docx source" }))
    expect(scrollToTarget).not.toHaveBeenCalled()
  })

  it("bridges PDF sources to the viewer imperative target", () => {
    const scrollToPageArea = vi.fn()
    const { rerender } = render(
      <PdfSourceTargetHarness source={pdfSource} onScroll={scrollToPageArea} />
    )

    fireEvent.click(screen.getByRole("button", { name: "scroll pdf source" }))
    expect(scrollToPageArea).toHaveBeenCalledWith(
      { pageNumber: 3, left: 10, top: 20, width: 30, height: 40 },
      { behavior: "smooth" }
    )

    scrollToPageArea.mockClear()
    rerender(
      <PdfSourceTargetHarness source={csvSource} onScroll={scrollToPageArea} />
    )
    fireEvent.click(screen.getByRole("button", { name: "scroll pdf source" }))
    expect(scrollToPageArea).not.toHaveBeenCalled()

    rerender(
      <PdfSourceTargetHarness
        source={source({
          kind: "pdf_bbox",
          page: 0,
          left: 0.1,
          top: 0.2,
          width: 0.3,
          height: 0.4,
        })}
        onScroll={scrollToPageArea}
      />
    )
    fireEvent.click(screen.getByRole("button", { name: "scroll pdf source" }))
    expect(scrollToPageArea).not.toHaveBeenCalled()
  })

  it("bridges image sources to the viewer imperative target", () => {
    const scrollToFrameArea = vi.fn()
    const { rerender } = render(
      <ImageSourceTargetHarness
        source={imageSource}
        onScroll={scrollToFrameArea}
      />
    )

    fireEvent.click(screen.getByRole("button", { name: "scroll image source" }))
    expect(scrollToFrameArea).toHaveBeenCalledWith(
      2,
      { left: 15, top: 25, width: 35, height: 45 },
      { behavior: "smooth" }
    )

    rerender(
      <ImageSourceTargetHarness
        source={pdfSource}
        onScroll={scrollToFrameArea}
      />
    )
    fireEvent.click(screen.getByRole("button", { name: "scroll image source" }))
    expect(scrollToFrameArea).toHaveBeenLastCalledWith(
      3,
      { left: 10, top: 20, width: 30, height: 40 },
      { behavior: "smooth" }
    )

    scrollToFrameArea.mockClear()
    rerender(
      <ImageSourceTargetHarness
        source={csvSource}
        onScroll={scrollToFrameArea}
      />
    )
    fireEvent.click(screen.getByRole("button", { name: "scroll image source" }))
    expect(scrollToFrameArea).not.toHaveBeenCalled()
  })

  it("bridges CSV and XLSX sources to viewer imperative targets", () => {
    const scrollToCsvCell = vi.fn()
    const { rerender: rerenderCsv } = render(
      <CsvSourceTargetHarness source={csvSource} onScroll={scrollToCsvCell} />
    )

    fireEvent.click(screen.getByRole("button", { name: "scroll csv source" }))
    expect(scrollToCsvCell).toHaveBeenCalledWith(
      { rowIndex: 3, columnIndex: 26 },
      { behavior: "smooth" }
    )

    scrollToCsvCell.mockClear()
    rerenderCsv(
      <CsvSourceTargetHarness source={xlsxSource} onScroll={scrollToCsvCell} />
    )
    fireEvent.click(screen.getByRole("button", { name: "scroll csv source" }))
    expect(scrollToCsvCell).not.toHaveBeenCalled()

    const scrollToXlsxCell = vi.fn()
    const { rerender: rerenderXlsx } = render(
      <XlsxSourceTargetHarness
        source={xlsxSource}
        onScroll={scrollToXlsxCell}
      />
    )

    fireEvent.click(screen.getByRole("button", { name: "scroll xlsx source" }))
    expect(scrollToXlsxCell).toHaveBeenCalledWith(2, 7, 51, {
      behavior: "smooth",
    })

    scrollToXlsxCell.mockClear()
    rerenderXlsx(
      <XlsxSourceTargetHarness source={csvSource} onScroll={scrollToXlsxCell} />
    )
    fireEvent.click(screen.getByRole("button", { name: "scroll xlsx source" }))
    expect(scrollToXlsxCell).not.toHaveBeenCalled()
  })

  it("bridges text sources to the viewer imperative target", () => {
    const scrollToLineRange = vi.fn()
    const { rerender } = render(
      <TextSourceTargetHarness
        source={textSource}
        onScroll={scrollToLineRange}
      />
    )

    fireEvent.click(screen.getByRole("button", { name: "scroll text source" }))
    expect(scrollToLineRange).toHaveBeenCalledWith(
      { start: 12, end: 14 },
      { behavior: "smooth" }
    )

    scrollToLineRange.mockClear()
    rerender(
      <TextSourceTargetHarness
        source={csvSource}
        onScroll={scrollToLineRange}
      />
    )
    fireEvent.click(screen.getByRole("button", { name: "scroll text source" }))
    expect(scrollToLineRange).not.toHaveBeenCalled()
  })
})

function DocxSourceTargetHarness({
  source,
  onScroll,
}: {
  source: Source
  onScroll: DocxViewerHandle["scrollToTarget"]
}) {
  const handle = React.useMemo<DocxViewerHandle>(
    () => ({
      scrollToTarget: onScroll,
      getViewportElement: () => null,
    }),
    [onScroll]
  )
  const viewerRef = useLatestTestRef<DocxViewerHandle>(handle)
  const target = useDocxSourceTarget(viewerRef)

  return (
    <button
      type="button"
      onClick={() => target.scrollTo?.(source, { behavior: "smooth" })}
    >
      scroll docx source
    </button>
  )
}

function PdfSourceTargetHarness({
  source,
  onScroll,
}: {
  source: Source
  onScroll: PdfViewerHandle["scrollToPageArea"]
}) {
  const handle = React.useMemo<PdfViewerHandle>(
    () => ({
      scrollToPage: vi.fn(),
      scrollToPageArea: onScroll,
      getViewportElement: () => null,
    }),
    [onScroll]
  )
  const viewerRef = useLatestTestRef<PdfViewerHandle>(handle)
  const target = usePdfSourceTarget(viewerRef)

  return (
    <button
      type="button"
      onClick={() => target.scrollTo?.(source, { behavior: "smooth" })}
    >
      scroll pdf source
    </button>
  )
}

function ImageSourceTargetHarness({
  source,
  onScroll,
}: {
  source: Source
  onScroll: ImageViewerHandle["scrollToFrameArea"]
}) {
  const handle = React.useMemo<ImageViewerHandle>(
    () => ({
      scrollToFrameArea: onScroll,
      getViewportElement: () => null,
    }),
    [onScroll]
  )
  const viewerRef = useLatestTestRef<ImageViewerHandle>(handle)
  const target = useImageSourceTarget(viewerRef)

  return (
    <button
      type="button"
      onClick={() => target.scrollTo?.(source, { behavior: "smooth" })}
    >
      scroll image source
    </button>
  )
}

function CsvSourceTargetHarness({
  source,
  onScroll,
}: {
  source: Source
  onScroll: CsvViewerHandle["scrollToCell"]
}) {
  const handle = React.useMemo<CsvViewerHandle>(
    () => ({
      scrollToCell: onScroll,
      getViewportElement: () => null,
    }),
    [onScroll]
  )
  const viewerRef = useLatestTestRef<CsvViewerHandle>(handle)
  const target = useCsvSourceTarget(viewerRef)

  return (
    <button
      type="button"
      onClick={() => target.scrollTo?.(source, { behavior: "smooth" })}
    >
      scroll csv source
    </button>
  )
}

function XlsxSourceTargetHarness({
  source,
  onScroll,
}: {
  source: Source
  onScroll: XlsxViewerHandle["scrollToCell"]
}) {
  const handle = React.useMemo<XlsxViewerHandle>(
    () => ({
      scrollToCell: onScroll,
      getViewportElement: () => null,
    }),
    [onScroll]
  )
  const viewerRef = useLatestTestRef<XlsxViewerHandle>(handle)
  const target = useXlsxSourceTarget(viewerRef)

  return (
    <button
      type="button"
      onClick={() => target.scrollTo?.(source, { behavior: "smooth" })}
    >
      scroll xlsx source
    </button>
  )
}

function TextSourceTargetHarness({
  source,
  onScroll,
}: {
  source: Source
  onScroll: TextViewerHandle["scrollToLineRange"]
}) {
  const handle = React.useMemo<TextViewerHandle>(
    () => ({
      scrollToLineRange: onScroll,
      getViewportElement: () => null,
    }),
    [onScroll]
  )
  const viewerRef = useLatestTestRef<TextViewerHandle>(handle)
  const target = useTextSourceTarget(viewerRef)

  return (
    <button
      type="button"
      onClick={() => target.scrollTo?.(source, { behavior: "smooth" })}
    >
      scroll text source
    </button>
  )
}

function useLatestTestRef<T>(value: T): React.RefObject<T | null> {
  const ref = React.useRef<T | null>(value)
  React.useLayoutEffect(() => {
    ref.current = value
  }, [value])
  return ref
}

describe("source UI components", () => {
  const fields = [
    { key: "total", label: "Total", value: "$120.00", hint: "Page 3" },
    { key: "date", label: "Date", value: "2026-06-12", hint: "AA4" },
    { key: "missing", label: "Approver", value: "Morgan Lee" },
    { key: "", label: "Root value", value: "standalone" },
  ]

  it("SourceFieldList renders fields and forwards hover, focus, blur, and click events", () => {
    const link = {
      activePath: "total",
      onFieldHover: vi.fn(),
      selectField: vi.fn(),
    }

    render(
      <SourceFieldList
        title="Invoice fields"
        fields={[
          {
            key: "total",
            label: "Total",
            value: <strong>$120.00</strong>,
            hint: "Page 2",
          },
          { key: "date", label: "Date", value: "2026-06-12" },
        ]}
        link={link}
      />
    )

    expect(
      screen.getByRole("heading", { name: "Invoice fields" }).textContent
    ).toBe("Invoice fields")
    expect(screen.getByText("2 fields").textContent).toBe("2 fields")
    expect(screen.getByText("$120.00").textContent).toBe("$120.00")
    expect(screen.getByText("Page 2").textContent).toBe("Page 2")

    const total = screen.getByRole("option", { name: /total/i })
    expect(total.getAttribute("data-active")).toBe("true")

    fireEvent.mouseEnter(total)
    fireEvent.focus(total)
    fireEvent.mouseLeave(total)
    fireEvent.blur(total)
    fireEvent.click(total)

    expect(link.onFieldHover.mock.calls).toEqual([
      ["total"],
      ["total"],
      [null],
      [null],
    ])
    expect(link.selectField).toHaveBeenCalledWith("total")
  })

  it("SourceFieldList marks only the exact active path", () => {
    const link = {
      activePath: "total.tax",
      onFieldHover: vi.fn(),
      selectField: vi.fn(),
    }

    const { rerender } = render(
      <SourceFieldList
        fields={[
          { key: "total", label: "Total", value: "$120.00" },
          { key: "total.tax", label: "Tax", value: "$8.00" },
        ]}
        link={link}
      />
    )

    const total = screen.getByRole("option", { name: /total/i })
    const tax = screen.getByRole("option", { name: /tax/i })
    expect(total.getAttribute("data-active")).toBe("false")
    expect(tax.getAttribute("data-active")).toBe("true")

    rerender(
      <SourceFieldList
        fields={[
          { key: "total", label: "Total", value: "$120.00" },
          { key: "total.tax", label: "Tax", value: "$8.00" },
        ]}
        link={{ ...link, activePath: "total" }}
      />
    )

    expect(
      screen.getByRole("option", { name: /total/i }).getAttribute("data-active")
    ).toBe("true")
    expect(
      screen.getByRole("option", { name: /tax/i }).getAttribute("data-active")
    ).toBe("false")
  })

  it("SourceFieldList renders an empty state without interactive rows", () => {
    const { container } = render(
      <SourceFieldList
        title="No fields"
        className="custom-source-list"
        fields={[]}
        link={{
          activePath: null,
          onFieldHover: vi.fn(),
          selectField: vi.fn(),
        }}
      />
    )

    expect(screen.getByRole("heading", { name: "No fields" })).toBeTruthy()
    expect(screen.getByText("0 fields").textContent).toBe("0 fields")
    expect(screen.getByText("No fields.")).toBeTruthy()
    expect(screen.queryAllByRole("option")).toHaveLength(0)
    expect(
      container.querySelector('[data-slot="source-field-list"]')?.className
    ).toContain("custom-source-list")
  })

  it("SourceFieldList handles dynamic field rows without keeping removed controls", () => {
    const link = {
      activePath: "date",
      onFieldHover: vi.fn(),
      selectField: vi.fn(),
    }
    const { rerender } = render(
      <SourceFieldList
        fields={[
          { key: "total", label: "Total", value: "$120.00" },
          { key: "date", label: "Date", value: "2026-06-12" },
        ]}
        link={link}
      />
    )

    expect(screen.getByText("2 fields").textContent).toBe("2 fields")
    expect(
      screen.getByRole("option", { name: /date/i }).getAttribute("data-active")
    ).toBe("true")

    rerender(
      <SourceFieldList
        fields={[
          { key: "total", label: "Total", value: "$120.00" },
          { key: "status", label: "Status", value: "Approved" },
        ]}
        link={link}
      />
    )

    expect(screen.getByText("2 fields").textContent).toBe("2 fields")
    expect(screen.queryByRole("option", { name: /date/i })).toBeNull()
    expect(
      screen
        .getByRole("option", { name: /status/i })
        .getAttribute("data-active")
    ).toBe("false")
  })

  it("SourceIndicator renders empty, found, and missing-source states", () => {
    const { container, rerender } = render(
      <SourceIndicator path={null} found={false} emptyHint="Pick a field" />
    )
    expect(container.firstElementChild?.className).toContain("top-12")
    expect(container.firstElementChild?.className).not.toContain("top-3")
    expect(screen.getByText("Pick a field").textContent).toBe("Pick a field")

    rerender(<SourceIndicator path="owner.name" found label="Field source" />)
    expect(screen.getByText("Field source").textContent).toBe("Field source")
    expect(screen.getByText("owner.name").textContent).toBe("owner.name")

    rerender(<SourceIndicator path="owner.email" found={false} />)
    expect(screen.getByText("owner.email").textContent).toBe("owner.email")
    expect(screen.getByText("· no source").textContent).toBe("· no source")
  })

  it("SourceIndicator treats an empty string path as an active root source", () => {
    const { rerender } = render(
      <SourceIndicator path="" found label="Root source" />
    )

    expect(screen.getByText("Root source").textContent).toBe("Root source")
    expect(screen.queryByText("Hover a field to view its source")).toBeNull()
    expect(screen.queryByText("· no source")).toBeNull()

    rerender(<SourceIndicator path="" found={false} />)
    expect(screen.getByText("· no source").textContent).toBe("· no source")
  })
})
