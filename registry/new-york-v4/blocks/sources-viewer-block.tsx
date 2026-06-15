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
  type AnchoredDocumentTarget,
  type AnchoredItem,
} from "@/components/ui/anchored-document-viewer"
import { CsvViewer, type CsvViewerHandle } from "@/components/ui/csv-viewer"
import { DocxViewer, type DocxViewerHandle } from "@/components/ui/docx-viewer"
import {
  useAnchoredSourceFieldLink,
  useSegmentedSourceFieldLink,
  type SourceFieldLink,
  type SegmentedSourceFieldLink,
} from "@/components/ui/source-field-link"
import { ImageViewer } from "@/components/ui/image-viewer"
import {
  PdfViewerHeader,
  PdfViewerPages,
  PdfViewerProvider,
} from "@/components/ui/pdf-viewer"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  SegmentedDocumentProvider,
  useSegmentedDocumentViewport,
} from "@/components/ui/segmented-document-provider"
import {
  sourceFieldsToEvidenceModel,
  sourceMapToEvidenceModel,
} from "@/components/ui/source-evidence"
import { SourceIndicator } from "@/components/ui/source-indicator"
import {
  sourceFieldsToSegmentedDocumentModel,
  sourceMapToSegmentedDocumentModel,
} from "@/components/ui/source-segmented-document-model"
import {
  useSegmentedImageSourceOverlay,
  useSegmentedImageViewerHandle,
  useSegmentedPdfSourceOverlay,
  useSegmentedPdfViewerHandle,
} from "@/components/ui/source-segmented-document-overlays"
import { TextViewer, type TextViewerHandle } from "@/components/ui/text-viewer"
import {
  ViewerBody,
  ViewerHeader,
  ViewerRoot,
  ViewerSidebar,
  ViewerSidebarTrigger,
  ViewerSurface,
} from "@/components/ui/viewer"
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

type SourceExtraction = {
  items: AnchoredItem[]
  schema: JSONSchema7
  sources: SourceMap
  values: Record<string, unknown>
}

// Build a JSON form's inputs from a flat field array. The schema property names
// match the source-map keys, which become anchored item ids for json-form hover
// and click interactions.
function flatSourceExtraction(fields: FlatField[]): SourceExtraction {
  const sources = Object.fromEntries(
    fields.map((field) => [field.key, field.source])
  )
  const evidence = sourceFieldsToEvidenceModel(fields)

  return {
    items: evidence.anchoredItems,
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
const PDF_SOURCE_MAP = extractionSourcesToSourceMap(jsonFormSample.sources)
const PDF_EVIDENCE = sourceMapToEvidenceModel({
  sourceMap: PDF_SOURCE_MAP,
  schema: jsonFormSample.schema as JSONSchema7,
  values: jsonFormSample.extraction as Record<string, unknown>,
})
const PDF_SEGMENTED_DOCUMENT = sourceMapToSegmentedDocumentModel({
  labels: Object.fromEntries(
    PDF_EVIDENCE.evidenceItems.map((item) => [item.id, item.payload.label])
  ),
  sourceMap: PDF_SOURCE_MAP,
})
const PDF_INITIAL_SOURCE_PATH =
  PDF_EVIDENCE.evidenceItems.find((item) => item.anchor.status === "resolved")
    ?.id ?? null
const PDF_EXTRACTION: SourceExtraction = {
  items: PDF_EVIDENCE.anchoredItems,
  schema: jsonFormSample.schema as JSONSchema7,
  sources: PDF_SOURCE_MAP,
  values: jsonFormSample.extraction as Record<string, unknown>,
}
const IMAGE_FIELDS = imageSample as FlatField[]
const IMAGE_EXTRACTION = flatSourceExtraction(IMAGE_FIELDS)
const IMAGE_SEGMENTED_DOCUMENT = sourceFieldsToSegmentedDocumentModel(
  IMAGE_FIELDS.map((field) => ({
    id: field.key,
    label: field.label,
    source: field.source,
  }))
)
const TEXT_EXTRACTION = flatSourceExtraction(textSample as FlatField[])
const CSV_EXTRACTION = flatSourceExtraction(csvSample as FlatField[])
const XLSX_EXTRACTION = flatSourceExtraction(xlsxSample as FlatField[])
const DOCX_EXTRACTION = flatSourceExtraction(docxSample as FlatField[])

// ── Shared layout: viewer + json-form source panel ────────────────────────────

/**
 * The source shell every tab shares: the source document on the left, the
 * extracted values rendered as a JSON form on the right. Hovering or clicking a
 * form field reports its path to the anchored provider, which scrolls and
 * highlights through the active document target.
 */
function SourcesShell({
  extraction,
  children,
}: {
  extraction: SourceExtraction
  children: React.ReactNode
}) {
  const link = useAnchoredSourceFieldLink()
  const { activeItem } = useAnchoredDocument()

  return (
    <ViewerRoot bare defaultOpen className="h-full bg-background">
      <ViewerHeader className="flex min-h-10 items-center gap-2 px-2">
        <ViewerSidebarTrigger />
        <h2 className="min-w-0 truncate text-sm font-medium">
          Source-linked results
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
          aria-label="Source-linked fields"
          side="right"
          width="420px"
          className="flex flex-shrink-0 flex-col border-l"
        >
          <SourcesForm extraction={extraction} link={link} />
        </ViewerSidebar>
      </ViewerBody>
    </ViewerRoot>
  )
}

function SegmentedSourcesShell({
  children,
  extraction,
  link,
}: {
  children: React.ReactNode
  extraction: SourceExtraction
  link: SegmentedSourceFieldLink
}) {
  return (
    <ViewerRoot bare defaultOpen className="h-full bg-background">
      <ViewerHeader className="flex min-h-10 items-center gap-2 px-2">
        <ViewerSidebarTrigger />
        <h2 className="min-w-0 truncate text-sm font-medium">
          Source-linked results
        </h2>
      </ViewerHeader>
      <ViewerBody>
        <ViewerSurface className="relative">
          {children}
          <SourceIndicator path={link.activePath} found={!!link.activeAnchor} />
        </ViewerSurface>
        <ViewerSidebar
          aria-label="Source-linked fields"
          side="right"
          width="420px"
          className="flex flex-shrink-0 flex-col border-l"
        >
          <SourcesForm extraction={extraction} link={link} />
        </ViewerSidebar>
      </ViewerBody>
    </ViewerRoot>
  )
}

function SourcesForm({
  extraction,
  link,
}: {
  extraction: SourceExtraction
  link: SourceFieldLink
}) {
  const form = useForm<Record<string, unknown>>({
    defaultValues: extraction.values,
  })

  // `json-form` is field-anchor-aware: pass the link and every field becomes a
  // hoverable card that reports its path. No per-field wiring needed.
  return (
    <>
      <div className="flex h-10 flex-shrink-0 items-center gap-2 border-b px-4">
        <h2 className="text-sm font-medium">Source-linked data</h2>
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
  return (
    <SegmentedDocumentProvider model={PDF_SEGMENTED_DOCUMENT}>
      <PdfTabContent />
    </SegmentedDocumentProvider>
  )
}

function PdfTabContent() {
  const link = useSegmentedSourceFieldLink({ initialPath: PDF_INITIAL_SOURCE_PATH })
  const { documentHandlers } = useSegmentedDocumentViewport()
  const renderPageOverlay = useSegmentedPdfSourceOverlay(link)
  const setPdfViewerHandle = useSegmentedPdfViewerHandle()

  return (
    <SegmentedSourcesShell extraction={PDF_EXTRACTION} link={link}>
      <PdfViewerProvider
        source={{
          kind: "url",
          url: PDF_URL,
          fileName: "jane-doe-bank-statement-5-pages.pdf",
        }}
      >
        <div className="flex h-full min-h-0 flex-col">
          <PdfViewerHeader />
          <PdfViewerPages
            ref={setPdfViewerHandle}
            bare
            className="min-h-0 flex-1"
            onScrollProgressChange={documentHandlers.onScrollProgressChange}
            onVisiblePageChange={documentHandlers.onCurrentPageChange}
            renderPageOverlay={renderPageOverlay}
          />
        </div>
      </PdfViewerProvider>
    </SegmentedSourcesShell>
  )
}

function ImageTab() {
  return (
    <SegmentedDocumentProvider model={IMAGE_SEGMENTED_DOCUMENT}>
      <ImageTabContent />
    </SegmentedDocumentProvider>
  )
}

function ImageTabContent() {
  const link = useSegmentedSourceFieldLink({ initialPath: IMAGE_FIELDS[0]?.key })
  const { documentHandlers } = useSegmentedDocumentViewport()
  const renderFrameOverlay = useSegmentedImageSourceOverlay(link)
  const setImageViewerHandle = useSegmentedImageViewerHandle()

  return (
    <SegmentedSourcesShell extraction={IMAGE_EXTRACTION} link={link}>
      <ImageViewer
        ref={setImageViewerHandle}
        source={{
          kind: "url",
          url: IMAGE_URL,
          fileName: "an-image-is-worth-16x16-words-page-1.png",
        }}
        bare
        className="h-full"
        onScrollProgressChange={documentHandlers.onScrollProgressChange}
        onVisibleFrameChange={documentHandlers.onCurrentPageChange}
        renderFrameOverlay={renderFrameOverlay}
      />
    </SegmentedSourcesShell>
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
    <SourcesShell extraction={TEXT_EXTRACTION}>
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
    </SourcesShell>
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
    <SourcesShell extraction={CSV_EXTRACTION}>
      <CsvViewer
        ref={viewerRef}
        source={{ kind: "text", text: CSV_TEXT, fileName: "sales.csv" }}
        fillHeight
        className="h-full rounded-none border-0"
        activeCell={activeCell}
      />
    </SourcesShell>
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
    <SourcesShell extraction={XLSX_EXTRACTION}>
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
    </SourcesShell>
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
    <SourcesShell extraction={DOCX_EXTRACTION}>
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
    </SourcesShell>
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
 * Sources viewer — every source-backed format in one component. A tab bar switches
 * the file format (PDF, image, text, CSV, Excel, Word); each tab is the same
 * source shell: the source document beside a JSON form of its extracted values,
 * linked by their sources. The same anchored-document provider drives every
 * viewer; only the viewer + its target adapter differ per tab.
 *
 * Tabs mount lazily on first visit and stay mounted (hidden) afterwards, so each
 * format's viewer keeps its scroll position and avoids re-fetching its document.
 */
export function SourcesViewerBlock() {
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
        aria-label="Source format"
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
