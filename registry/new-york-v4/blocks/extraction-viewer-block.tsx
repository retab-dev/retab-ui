"use client"

import * as React from "react"
import type { JSONSchema7 } from "json-schema"
import { useForm } from "react-hook-form"

import {
  extractionSourcesToSourceMap,
  type Source,
  type SourceMap,
} from "@/lib/document-source"
import { cn } from "@/lib/utils"
import {
  AnchoredDocumentProvider,
  useAnchoredDocument,
  useAnchoredFieldLink,
  type AnchoredDocumentTarget,
  type AnchoredItem,
  type DocumentAnchor,
} from "@/components/ui/anchored-document-viewer"
import { csvAnchorToTarget } from "@/components/ui/csv-source"
import { CsvViewer, type CsvViewerHandle } from "@/components/ui/csv-viewer"
import { docxAnchorToTarget } from "@/components/ui/docx-source"
import { DocxViewer, type DocxViewerHandle } from "@/components/ui/docx-viewer"
import {
  imageAnchorToTarget,
  rotateImageArea,
} from "@/components/ui/image-source"
import {
  ImageViewer,
  type ImageViewerHandle,
} from "@/components/ui/image-viewer"
import type { ImageFrameOverlayProps } from "@/components/ui/image-viewer-types"
import {
  sourceToPdfAnchor,
  usePdfAnchoredOverlay,
  usePdfAnchoredTarget,
} from "@/components/ui/pdf-anchor-target"
import {
  PdfViewerPages,
  PdfViewerProvider,
  type PdfViewerHandle,
} from "@/components/ui/pdf-viewer"
import { ScrollArea } from "@/components/ui/scroll-area"
import { SourceIndicator } from "@/components/ui/source-indicator"
import { textAnchorToTarget } from "@/components/ui/text-source"
import { TextViewer, type TextViewerHandle } from "@/components/ui/text-viewer"
import {
  ViewerBody,
  ViewerSurface,
  ViewerHeader,
  ViewerSidebar,
  ViewerRoot,
  ViewerSidebarTrigger,
} from "@/components/ui/viewer"
import { xlsxAnchorToTarget } from "@/components/ui/xlsx-source"
import { XlsxViewer, type XlsxViewerHandle } from "@/components/ui/xlsx-viewer"
import { JsonForm } from "@/components/json-form/json-form"
import csvSample from "@/components/viewers/sample-data/csv-sources.json"
import docxSample from "@/components/viewers/sample-data/docx-sources.json"
import imageSample from "@/components/viewers/sample-data/image-sources.json"
import jsonFormSample from "@/components/viewers/sample-data/json-form-sources.json"
import textSample from "@/components/viewers/sample-data/text-sources.json"
import xlsxSample from "@/components/viewers/sample-data/xlsx-sources.json"

// ── Sample sources, one per file format ───────────────────────────────────────

const PDF_URL = "/samples/jane-doe-bank-statement-5-pages.pdf"
const IMAGE_URL = "/samples/an-image-is-worth-16x16-words-page-1.png"
const TEXT_URL = "/samples/extraction-run.log"
const XLSX_URL = "/samples/nvidia-financials-fy2024.xlsx"
const DOCX_URL = "/samples/quarterly-business-review.docx"

const CSV_TEXT = `region,quarter,revenue,customers,nrr
North America,Q1,1240000,48,1.12
North America,Q2,1510000,61,1.21
EMEA,Q1,820000,33,1.08
EMEA,Q2,910000,39,1.15
APAC,Q1,430000,18,1.04
APAC,Q2,560000,24,1.11`

// A flat extraction sample: each field is a scalar with the source it came from.
type FlatField = { key: string; label: string; value: string; source: Source }

type Extraction = {
  items: AnchoredItem[]
  schema: JSONSchema7
  sources: SourceMap
  values: Record<string, unknown>
}

// Build a JSON form's inputs from a flat field array. The schema property names
// match the source-map keys, which become anchored item ids for json-form hover
// and click interactions.
function flatExtraction(fields: FlatField[]): Extraction {
  const sources = Object.fromEntries(
    fields.map((field) => [field.key, field.source])
  )

  return {
    items: sourcesToAnchoredItems(sources),
    schema: {
      type: "object",
      properties: Object.fromEntries(
        fields.map((field) => [
          field.key,
          { type: "string", title: field.label },
        ])
      ),
    },
    values: Object.fromEntries(fields.map((field) => [field.key, field.value])),
    sources,
  }
}

// The PDF tab uses the richer, nested extraction sample (a real /sources
// response); the rest derive a flat form from their per-format field arrays.
const PDF_EXTRACTION: Extraction = {
  items: sourcesToAnchoredItems(
    extractionSourcesToSourceMap(jsonFormSample.sources)
  ),
  schema: jsonFormSample.schema as JSONSchema7,
  sources: extractionSourcesToSourceMap(jsonFormSample.sources),
  values: jsonFormSample.extraction as Record<string, unknown>,
}
const IMAGE_EXTRACTION = flatExtraction(imageSample as FlatField[])
const TEXT_EXTRACTION = flatExtraction(textSample as FlatField[])
const CSV_EXTRACTION = flatExtraction(csvSample as FlatField[])
const XLSX_EXTRACTION = flatExtraction(xlsxSample as FlatField[])
const DOCX_EXTRACTION = flatExtraction(docxSample as FlatField[])

function sourcesToAnchoredItems(sources: SourceMap): AnchoredItem[] {
  return Object.entries(sources).map(([id, source]) => ({
    id,
    anchor: sourceToDocumentAnchor(source),
  }))
}

function sourceToDocumentAnchor(source: Source): DocumentAnchor | null {
  if (source.anchor.kind === "pdf_bbox") {
    return sourceToPdfAnchor(source)
  }

  if (source.anchor.kind === "image_bbox") {
    const target = imageAnchorToTarget(source.anchor)
    return target
      ? {
          kind: "image-area",
          frameNumber: target.frame,
          left: target.area.left,
          top: target.area.top,
          width: target.area.width,
          height: target.area.height,
        }
      : null
  }

  if (source.anchor.kind === "text_span") {
    const target = textAnchorToTarget(source.anchor)
    return target
      ? {
          kind: "text-range",
          startLine: target.start,
          endLine: target.end,
        }
      : null
  }

  if (source.anchor.kind === "csv_cell") {
    const target = csvAnchorToTarget(source.anchor)
    return target
      ? {
          kind: "csv-cell",
          rowIndex: target.rowIndex,
          columnIndex: target.columnIndex,
        }
      : null
  }

  if (source.anchor.kind === "spreadsheet_cell") {
    const target = xlsxAnchorToTarget(source.anchor)
    return target
      ? {
          kind: "xlsx-cell",
          sheetIndex: target.sheet,
          rowIndex: target.row,
          columnIndex: target.col,
        }
      : null
  }

  if (
    source.anchor.kind === "docx_text_span" ||
    source.anchor.kind === "docx_table_cell"
  ) {
    const target = docxAnchorToTarget(source.anchor, source)
    return target
      ? {
          kind: "docx-target",
          target,
        }
      : null
  }

  return null
}

// ── Shared layout: viewer + json-form extraction panel ────────────────────────

/**
 * The extraction shell every tab shares: the source document on the left, the
 * extraction rendered as a JSON form on the right. Hovering or clicking a form
 * field reports its path to the anchored provider, which scrolls and highlights
 * through the active document target.
 */
function ExtractionShell({
  extraction,
  children,
}: {
  extraction: Extraction
  children: React.ReactNode
}) {
  const link = useAnchoredFieldLink()
  const { activeItem } = useAnchoredDocument()

  return (
    <ViewerRoot bare defaultSidebarOpen className="h-full bg-background">
      <ViewerHeader className="flex min-h-10 items-center gap-2 px-2">
        <ViewerSidebarTrigger />
        <h2 className="min-w-0 truncate text-sm font-medium">
          Extraction results
        </h2>
      </ViewerHeader>
      <ViewerBody>
        <ViewerSurface className="relative">
          {children}
          <SourceIndicator
            path={link.activePath}
            found={!!activeItem?.anchor}
          />
        </ViewerSurface>
        <ViewerSidebar
          aria-label="Extraction fields"
          side="right"
          width="420px"
          className="flex flex-shrink-0 flex-col border-l"
        >
          <ExtractionForm extraction={extraction} link={link} />
        </ViewerSidebar>
      </ViewerBody>
    </ViewerRoot>
  )
}

function ExtractionForm({
  extraction,
  link,
}: {
  extraction: Extraction
  link: ReturnType<typeof useAnchoredFieldLink>
}) {
  const form = useForm<Record<string, unknown>>({
    defaultValues: extraction.values,
  })

  // `json-form` is field-anchor-aware: pass the link and every field becomes a
  // hoverable card that reports its path. No per-field wiring needed.
  return (
    <>
      <div className="flex h-10 flex-shrink-0 items-center gap-2 border-b px-4">
        <h2 className="text-sm font-medium">Extracted data</h2>
        <span className="ml-auto text-xs text-muted-foreground">
          Hover a field to see its source
        </span>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <div className="p-4">
          <JsonForm form={form} schema={extraction.schema} anchorLink={link} />
        </div>
      </ScrollArea>
    </>
  )
}

const ACTIVE_ANCHOR_CLASS =
  "pointer-events-none absolute z-10 rounded-[2px] border border-primary/70 bg-primary/12 shadow-[0_4px_16px_rgb(0_0_0_/_8%)]"

function useImageAnchoredTarget(
  viewerRef: React.RefObject<ImageViewerHandle | null>
): AnchoredDocumentTarget {
  return React.useMemo(
    () => ({
      scrollToAnchor: (anchor, options) => {
        if (anchor.kind !== "image-area") return
        viewerRef.current?.scrollToFrameArea(
          anchor.frameNumber ?? 1,
          {
            left: anchor.left,
            top: anchor.top,
            width: anchor.width,
            height: anchor.height,
          },
          options
        )
      },
    }),
    [viewerRef]
  )
}

function useImageAnchoredOverlay() {
  const { activeAnchor } = useAnchoredDocument()

  return React.useCallback(
    ({ frameNumber, rotation }: ImageFrameOverlayProps) => {
      if (
        activeAnchor?.kind !== "image-area" ||
        (activeAnchor.frameNumber ?? 1) !== frameNumber
      ) {
        return null
      }

      const renderedArea = rotateImageArea(
        {
          left: activeAnchor.left,
          top: activeAnchor.top,
          width: activeAnchor.width,
          height: activeAnchor.height,
        },
        rotation
      )

      return (
        <div
          className={ACTIVE_ANCHOR_CLASS}
          style={{
            left: `${renderedArea.left}%`,
            top: `${renderedArea.top}%`,
            width: `${renderedArea.width}%`,
            height: `${renderedArea.height}%`,
          }}
        />
      )
    },
    [activeAnchor]
  )
}

function useTextAnchoredTarget(
  viewerRef: React.RefObject<TextViewerHandle | null>
): AnchoredDocumentTarget {
  return React.useMemo(
    () => ({
      scrollToAnchor: (anchor, options) => {
        if (anchor.kind !== "text-range") return
        viewerRef.current?.scrollToLineRange(
          {
            start: anchor.startLine,
            end: anchor.endLine,
          },
          options
        )
      },
    }),
    [viewerRef]
  )
}

function useActiveTextHighlight() {
  const { activeAnchor } = useAnchoredDocument()
  return activeAnchor?.kind === "text-range"
    ? {
        start: activeAnchor.startLine,
        end: activeAnchor.endLine,
      }
    : null
}

function useCsvAnchoredTarget(
  viewerRef: React.RefObject<CsvViewerHandle | null>
): AnchoredDocumentTarget {
  return React.useMemo(
    () => ({
      scrollToAnchor: (anchor, options) => {
        if (anchor.kind !== "csv-cell") return
        viewerRef.current?.scrollToCell(
          {
            rowIndex: anchor.rowIndex,
            columnIndex: anchor.columnIndex,
          },
          options
        )
      },
    }),
    [viewerRef]
  )
}

function useActiveCsvCell() {
  const { activeAnchor } = useAnchoredDocument()
  return activeAnchor?.kind === "csv-cell"
    ? {
        rowIndex: activeAnchor.rowIndex,
        columnIndex: activeAnchor.columnIndex,
      }
    : null
}

function useXlsxAnchoredTarget(
  viewerRef: React.RefObject<XlsxViewerHandle | null>
): AnchoredDocumentTarget {
  return React.useMemo(
    () => ({
      scrollToAnchor: (anchor, options) => {
        if (anchor.kind !== "xlsx-cell") return
        viewerRef.current?.scrollToCell(
          anchor.sheetIndex,
          anchor.rowIndex,
          anchor.columnIndex,
          options
        )
      },
    }),
    [viewerRef]
  )
}

function useActiveXlsxCell() {
  const { activeAnchor } = useAnchoredDocument()
  return activeAnchor?.kind === "xlsx-cell"
    ? {
        sheet: activeAnchor.sheetIndex,
        row: activeAnchor.rowIndex,
        col: activeAnchor.columnIndex,
      }
    : null
}

function useDocxAnchoredTarget(
  viewerRef: React.RefObject<DocxViewerHandle | null>
): AnchoredDocumentTarget {
  return React.useMemo(
    () => ({
      scrollToAnchor: (anchor, options) => {
        if (anchor.kind !== "docx-target") return
        viewerRef.current?.scrollToTarget(anchor.target, options)
      },
    }),
    [viewerRef]
  )
}

function useActiveDocxHighlight() {
  const { activeAnchor } = useAnchoredDocument()
  return activeAnchor?.kind === "docx-target" ? activeAnchor.target : null
}

// ── Per-format tabs ───────────────────────────────────────────────────────────

function PdfTab() {
  const viewerRef = React.useRef<PdfViewerHandle>(null)
  const target = usePdfAnchoredTarget(viewerRef)

  return (
    <AnchoredDocumentProvider items={PDF_EXTRACTION.items} target={target}>
      <PdfTabContent viewerRef={viewerRef} />
    </AnchoredDocumentProvider>
  )
}

function PdfTabContent({
  viewerRef,
}: {
  viewerRef: React.RefObject<PdfViewerHandle | null>
}) {
  const renderPageOverlay = usePdfAnchoredOverlay({ mode: "active" })

  return (
    <ExtractionShell extraction={PDF_EXTRACTION}>
      <PdfViewerProvider
        source={{
          kind: "url",
          url: PDF_URL,
          fileName: "jane-doe-bank-statement-5-pages.pdf",
        }}
      >
        <PdfViewerPages
          ref={viewerRef}
          bare
          className="h-full"
          renderPageOverlay={renderPageOverlay}
        />
      </PdfViewerProvider>
    </ExtractionShell>
  )
}

function ImageTab() {
  const viewerRef = React.useRef<ImageViewerHandle>(null)
  const target = useImageAnchoredTarget(viewerRef)

  return (
    <AnchoredDocumentProvider items={IMAGE_EXTRACTION.items} target={target}>
      <ImageTabContent viewerRef={viewerRef} />
    </AnchoredDocumentProvider>
  )
}

function ImageTabContent({
  viewerRef,
}: {
  viewerRef: React.RefObject<ImageViewerHandle | null>
}) {
  const renderFrameOverlay = useImageAnchoredOverlay()

  return (
    <ExtractionShell extraction={IMAGE_EXTRACTION}>
      <ImageViewer
        ref={viewerRef}
        source={{
          kind: "url",
          url: IMAGE_URL,
          fileName: "an-image-is-worth-16x16-words-page-1.png",
        }}
        bare
        className="h-full"
        renderFrameOverlay={renderFrameOverlay}
      />
    </ExtractionShell>
  )
}

function TextTab() {
  const viewerRef = React.useRef<TextViewerHandle>(null)
  const target = useTextAnchoredTarget(viewerRef)

  return (
    <AnchoredDocumentProvider items={TEXT_EXTRACTION.items} target={target}>
      <TextTabContent viewerRef={viewerRef} />
    </AnchoredDocumentProvider>
  )
}

function TextTabContent({
  viewerRef,
}: {
  viewerRef: React.RefObject<TextViewerHandle | null>
}) {
  const highlight = useActiveTextHighlight()

  return (
    <ExtractionShell extraction={TEXT_EXTRACTION}>
      <TextViewer
        ref={viewerRef}
        source={{
          kind: "url",
          url: TEXT_URL,
          fileName: "extraction-run.log",
        }}
        bare
        className="h-full"
        highlight={highlight}
        mode="text"
      />
    </ExtractionShell>
  )
}

function CsvTab() {
  const viewerRef = React.useRef<CsvViewerHandle>(null)
  const target = useCsvAnchoredTarget(viewerRef)

  return (
    <AnchoredDocumentProvider items={CSV_EXTRACTION.items} target={target}>
      <CsvTabContent viewerRef={viewerRef} />
    </AnchoredDocumentProvider>
  )
}

function CsvTabContent({
  viewerRef,
}: {
  viewerRef: React.RefObject<CsvViewerHandle | null>
}) {
  const activeCell = useActiveCsvCell()

  return (
    <ExtractionShell extraction={CSV_EXTRACTION}>
      <CsvViewer
        ref={viewerRef}
        source={{ kind: "text", text: CSV_TEXT, fileName: "sales.csv" }}
        fillHeight
        className="h-full rounded-none border-0"
        activeCell={activeCell}
      />
    </ExtractionShell>
  )
}

function ExcelTab() {
  const viewerRef = React.useRef<XlsxViewerHandle>(null)
  const target = useXlsxAnchoredTarget(viewerRef)

  return (
    <AnchoredDocumentProvider items={XLSX_EXTRACTION.items} target={target}>
      <ExcelTabContent viewerRef={viewerRef} />
    </AnchoredDocumentProvider>
  )
}

function ExcelTabContent({
  viewerRef,
}: {
  viewerRef: React.RefObject<XlsxViewerHandle | null>
}) {
  const activeCell = useActiveXlsxCell()

  return (
    <ExtractionShell extraction={XLSX_EXTRACTION}>
      <XlsxViewer
        ref={viewerRef}
        source={{
          kind: "url",
          url: XLSX_URL,
          fileName: "nvidia-financials-fy2024.xlsx",
        }}
        bare
        className="h-full"
        activeCell={activeCell}
      />
    </ExtractionShell>
  )
}

function DocxTab() {
  const viewerRef = React.useRef<DocxViewerHandle>(null)
  const target = useDocxAnchoredTarget(viewerRef)

  return (
    <AnchoredDocumentProvider items={DOCX_EXTRACTION.items} target={target}>
      <DocxTabContent viewerRef={viewerRef} />
    </AnchoredDocumentProvider>
  )
}

function DocxTabContent({
  viewerRef,
}: {
  viewerRef: React.RefObject<DocxViewerHandle | null>
}) {
  const highlight = useActiveDocxHighlight()

  return (
    <ExtractionShell extraction={DOCX_EXTRACTION}>
      <DocxViewer
        ref={viewerRef}
        source={{
          kind: "url",
          url: DOCX_URL,
          fileName: "quarterly-business-review.docx",
        }}
        bare
        className="h-full"
        highlight={highlight}
      />
    </ExtractionShell>
  )
}

const TABS = [
  { id: "pdf", label: "PDF", Tab: PdfTab },
  { id: "image", label: "Image", Tab: ImageTab },
  { id: "text", label: "Text", Tab: TextTab },
  { id: "csv", label: "CSV", Tab: CsvTab },
  { id: "excel", label: "Excel", Tab: ExcelTab },
  { id: "docx", label: "DOCX", Tab: DocxTab },
] as const

type TabId = (typeof TABS)[number]["id"]

/**
 * Extraction viewer — every source format in one component. A tab bar switches
 * the file format (PDF, image, text, CSV, Excel, Word); each tab is the same
 * extraction shell: the source document beside a JSON form of its extracted
 * values, linked by their sources. The same anchored-document provider drives
 * every viewer; only the viewer + its target adapter differ per tab.
 *
 * Tabs mount lazily on first visit and stay mounted (hidden) afterwards, so each
 * format's viewer keeps its scroll position and avoids re-fetching its document.
 */
export function ExtractionViewerBlock() {
  const [active, setActive] = React.useState<TabId>("pdf")
  const [mounted, setMounted] = React.useState<Set<TabId>>(
    () => new Set(["pdf"])
  )

  function selectTab(id: TabId) {
    setActive(id)
    setMounted((prev) => {
      if (prev.has(id)) return prev
      const next = new Set(prev)
      next.add(id)
      return next
    })
  }

  return (
    <div className="flex h-full min-h-[680px] flex-col bg-background">
      <div
        role="tablist"
        aria-label="Extraction format"
        className="flex h-11 flex-shrink-0 items-center gap-1 border-b px-2"
      >
        {TABS.map((tab) => {
          const isActive = tab.id === active
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => selectTab(tab.id)}
              className={cn(
                "relative h-full px-3 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
                isActive
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {tab.label}
              {isActive ? (
                <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-foreground" />
              ) : null}
            </button>
          )
        })}
      </div>
      <div className="relative min-h-0 flex-1">
        {TABS.map((tab) =>
          mounted.has(tab.id) ? (
            <div
              key={tab.id}
              role="tabpanel"
              hidden={tab.id !== active}
              className={cn(
                "absolute inset-0",
                tab.id === active ? "block" : "hidden"
              )}
            >
              <tab.Tab />
            </div>
          ) : null
        )}
      </div>
    </div>
  )
}
