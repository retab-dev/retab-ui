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
import { sourceToCsvCell, useCsvSourceTarget } from "@/components/ui/csv-source"
import {
  CsvViewerGrid,
  CsvViewerProvider,
  type CsvViewerHandle,
} from "@/components/ui/csv-viewer"
import {
  sourceToDocxHighlight,
  useDocxSourceTarget,
} from "@/components/ui/docx-source"
import {
  DocxViewerDocument,
  DocxViewerProvider,
  type DocxViewerHandle,
} from "@/components/ui/docx-viewer"
import {
  FileViewerBody,
  FileViewerControls,
  FileViewerHeader,
  FileViewerMeta,
  FileViewerSurface,
  FileViewerTitle,
} from "@/components/ui/file-viewer"
import {
  FileViewerProvider,
  useFileViewerResource,
} from "@/components/ui/file-viewer-internal"
import {
  ImageViewerFrames,
  ImageViewerProvider,
  type ImageViewerHandle,
} from "@/components/ui/image-viewer"
import { PdfViewerPages, PdfViewerProvider } from "@/components/ui/pdf-viewer"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  SegmentedDocumentProvider,
  useSegmentedDocumentViewport,
} from "@/components/ui/segmented-document-provider"
import { sourceMapToEvidenceModel } from "@/components/ui/source-evidence"
import {
  useSegmentedSourceFieldLink,
  type SegmentedSourceFieldLink,
  type SourceFieldLink,
} from "@/components/ui/source-field-link"
import { SourceIndicator } from "@/components/ui/source-indicator"
import { createSourcesSegmentedDocumentModel } from "@/components/ui/source-segmented-document-model"
import {
  useSegmentedImageSourceOverlay,
  useSegmentedImageViewerHandle,
  useSegmentedPdfSourceOverlay,
  useSegmentedPdfViewerHandle,
} from "@/components/ui/source-segmented-document-overlays"
import {
  sourceToTextHighlight,
  useTextSourceTarget,
} from "@/components/ui/text-source"
import {
  TextViewerDocument,
  TextViewerProvider,
  type TextViewerHandle,
} from "@/components/ui/text-viewer"
import {
  ViewerRoot,
  ViewerSidebar,
  ViewerSidebarTrigger,
} from "@/components/ui/viewer"
import {
  sourceToXlsxCell,
  useXlsxSourceTarget,
} from "@/components/ui/xlsx-source"
import {
  XlsxViewerProvider,
  XlsxViewerWorkbook,
  type XlsxViewerHandle,
} from "@/components/ui/xlsx-viewer"
import { JsonForm } from "@/components/json-form/json-form"
import csvSample from "@/components/viewers/sample-data/csv-sources.json"
import docxSample from "@/components/viewers/sample-data/docx-sources.json"
import imageSample from "@/components/viewers/sample-data/image-sources.json"
import jsonFormSample from "@/components/viewers/sample-data/json-form-sources.json"
import textSample from "@/components/viewers/sample-data/text-sources.json"
import xlsxSample from "@/components/viewers/sample-data/xlsx-sources.json"

// ── Sample sources, one per file format ───────────────────────────────────────

const PDF_URL = "/samples/jane-doe-bank-statement-5-pages.pdf"
const PDF_SOURCE = {
  kind: "url" as const,
  url: PDF_URL,
  fileName: "jane-doe-bank-statement-5-pages.pdf",
}
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
const IMAGE_SOURCE = {
  kind: "url" as const,
  url: IMAGE_URL,
  fileName: "an-image-is-worth-16x16-words-page-1.png",
}
const TEXT_SOURCE = {
  kind: "url" as const,
  url: TEXT_URL,
  fileName: "extraction-run.log",
}
const CSV_SOURCE = {
  kind: "text" as const,
  text: CSV_TEXT,
  fileName: "sales.csv",
}
const XLSX_SOURCE = {
  kind: "url" as const,
  url: XLSX_URL,
  fileName: "nvidia-financials-fy2024.xlsx",
}
const DOCX_SOURCE = {
  kind: "url" as const,
  url: DOCX_URL,
  fileName: "quarterly-business-review.docx",
}

// A flat extraction sample: each field is a scalar with the source it came from.
type FlatField = { key: string; label: string; value: string; source: Source }

type SourceExtraction = {
  schema: JSONSchema7
  sources: SourceMap
  values: Record<string, unknown>
}

type SourceLinkedViewerSource = React.ComponentProps<
  typeof FileViewerProvider
>["source"]

// Build a JSON form's inputs from a flat field array. The schema property names
// match the source-map keys used for json-form hover and click interactions.
function flatSourceExtraction(fields: FlatField[]): SourceExtraction {
  const sources = Object.fromEntries(
    fields.map((field) => [field.key, field.source])
  )

  return {
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
const PDF_SEGMENTED_DOCUMENT = createSourcesSegmentedDocumentModel({
  labels: Object.fromEntries(
    PDF_EVIDENCE.evidenceItems.map((item) => [item.id, item.payload.label])
  ),
  sourceMap: PDF_SOURCE_MAP,
})
const PDF_INITIAL_SOURCE_PATH =
  PDF_EVIDENCE.evidenceItems.find((item) => item.anchor.status === "resolved")
    ?.id ?? null
const PDF_EXTRACTION: SourceExtraction = {
  schema: jsonFormSample.schema as JSONSchema7,
  sources: PDF_SOURCE_MAP,
  values: jsonFormSample.extraction as Record<string, unknown>,
}
const IMAGE_FIELDS = imageSample as FlatField[]
const IMAGE_EXTRACTION = flatSourceExtraction(IMAGE_FIELDS)
const IMAGE_SEGMENTED_DOCUMENT = createSourcesSegmentedDocumentModel(
  fieldsToSegmentedFields(IMAGE_FIELDS)
)
const TEXT_FIELDS = textSample as FlatField[]
const TEXT_EXTRACTION = flatSourceExtraction(TEXT_FIELDS)
const TEXT_SEGMENTED_DOCUMENT = createSourcesSegmentedDocumentModel(
  fieldsToSegmentedFields(TEXT_FIELDS)
)
const CSV_FIELDS = csvSample as FlatField[]
const CSV_EXTRACTION = flatSourceExtraction(CSV_FIELDS)
const CSV_SEGMENTED_DOCUMENT = createSourcesSegmentedDocumentModel(
  fieldsToSegmentedFields(CSV_FIELDS)
)
const XLSX_FIELDS = xlsxSample as FlatField[]
const XLSX_EXTRACTION = flatSourceExtraction(XLSX_FIELDS)
const XLSX_SEGMENTED_DOCUMENT = createSourcesSegmentedDocumentModel(
  fieldsToSegmentedFields(XLSX_FIELDS)
)
const DOCX_FIELDS = docxSample as FlatField[]
const DOCX_EXTRACTION = flatSourceExtraction(DOCX_FIELDS)
const DOCX_SEGMENTED_DOCUMENT = createSourcesSegmentedDocumentModel(
  fieldsToSegmentedFields(DOCX_FIELDS)
)

function fieldsToSegmentedFields(fields: readonly FlatField[]) {
  return fields.map((field) => ({
    id: field.key,
    label: field.label,
    source: field.source,
  }))
}

// ── Shared layout: viewer + json-form source panel ────────────────────────────

function SourceLinkedFileHeader() {
  return (
    <FileViewerHeader>
      <ViewerSidebarTrigger className="-ml-1" />
      <FileViewerTitle />
      <FileViewerMeta />
      <FileViewerControls />
    </FileViewerHeader>
  )
}

function SourceLinkedViewer({
  children,
  extraction,
  link,
  source,
}: {
  children: React.ReactNode
  extraction: SourceExtraction
  link: SegmentedSourceFieldLink
  source: SourceLinkedViewerSource
}) {
  return (
    <ViewerRoot bare defaultOpen className="h-full bg-background">
      <FileViewerProvider source={source}>
        <SourceLinkedFileHeader />
        <FileViewerBody>
          <FileViewerSurface className="relative">
            {children}
            <SourceIndicator
              path={link.activePath}
              found={!!link.activeSegment}
            />
          </FileViewerSurface>
          <ViewerSidebar
            aria-label="Source-linked fields"
            side="right"
            width="420px"
            className="flex flex-shrink-0 flex-col border-l"
          >
            <SourcesForm extraction={extraction} link={link} />
          </ViewerSidebar>
        </FileViewerBody>
      </FileViewerProvider>
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

type SourceTarget = {
  scrollTo?: (source: Source, options: { behavior: ScrollBehavior }) => void
}

function useSourceTargetedSegmentedFieldLink({
  initialPath,
  sources,
  target,
}: {
  initialPath?: string | null
  sources: SourceMap
  target: SourceTarget
}): SegmentedSourceFieldLink {
  const link = useSegmentedSourceFieldLink({ initialPath })
  const scrollToPath = React.useCallback(
    (path: string, behavior: ScrollBehavior) => {
      const source = sources[path]
      if (source) target.scrollTo?.(source, { behavior })
    },
    [sources, target]
  )
  const onFieldHover = React.useCallback(
    (path: string | null) => {
      link.onFieldHover(path)
      if (path) scrollToPath(path, "auto")
    },
    [link, scrollToPath]
  )
  const selectField = React.useCallback(
    (path: string) => {
      link.selectField?.(path)
      scrollToPath(path, "smooth")
    },
    [link, scrollToPath]
  )

  return React.useMemo(
    () => ({
      ...link,
      onFieldHover,
      selectField,
    }),
    [link, onFieldHover, selectField]
  )
}

function sourceForPath(
  sources: SourceMap,
  path: string | null
): Source | undefined {
  return path ? sources[path] : undefined
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
  const link = useSegmentedSourceFieldLink({
    initialPath: PDF_INITIAL_SOURCE_PATH,
  })
  const { documentHandlers } = useSegmentedDocumentViewport()
  const renderPageOverlay = useSegmentedPdfSourceOverlay(link)
  const setPdfViewerHandle = useSegmentedPdfViewerHandle()

  return (
    <SourceLinkedViewer
      extraction={PDF_EXTRACTION}
      link={link}
      source={PDF_SOURCE}
    >
      <PdfViewerProvider>
        <PdfViewerPages
          ref={setPdfViewerHandle}
          bare
          className="h-full"
          onScrollProgressChange={documentHandlers.onScrollProgressChange}
          onVisiblePageChange={documentHandlers.onCurrentPageChange}
          renderPageOverlay={renderPageOverlay}
        />
      </PdfViewerProvider>
    </SourceLinkedViewer>
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
  const link = useSegmentedSourceFieldLink({
    initialPath: IMAGE_FIELDS[0]?.key,
  })
  const { documentHandlers } = useSegmentedDocumentViewport()
  const renderFrameOverlay = useSegmentedImageSourceOverlay(link)
  const setImageViewerHandle = useSegmentedImageViewerHandle()

  return (
    <SourceLinkedViewer
      extraction={IMAGE_EXTRACTION}
      link={link}
      source={IMAGE_SOURCE}
    >
      <FileResourceImageViewer
        ref={setImageViewerHandle}
        bare
        className="h-full"
        controls={false}
        onScrollProgressChange={documentHandlers.onScrollProgressChange}
        onVisibleFrameChange={documentHandlers.onCurrentPageChange}
        renderFrameOverlay={renderFrameOverlay}
      />
    </SourceLinkedViewer>
  )
}

function TextTab() {
  return (
    <SegmentedDocumentProvider model={TEXT_SEGMENTED_DOCUMENT}>
      <TextTabContent />
    </SegmentedDocumentProvider>
  )
}

function TextTabContent() {
  const viewerRef = React.useRef<TextViewerHandle>(null)
  const target = useTextSourceTarget(viewerRef)
  const link = useSourceTargetedSegmentedFieldLink({
    initialPath: TEXT_FIELDS[0]?.key,
    sources: TEXT_EXTRACTION.sources,
    target,
  })
  const highlight = sourceToTextHighlight(
    sourceForPath(TEXT_EXTRACTION.sources, link.activePath)
  )

  return (
    <SourceLinkedViewer
      extraction={TEXT_EXTRACTION}
      link={link}
      source={TEXT_SOURCE}
    >
      <FileResourceTextViewer
        ref={viewerRef}
        bare
        className="h-full"
        controls={false}
        highlight={highlight}
        mode="text"
      />
    </SourceLinkedViewer>
  )
}

function CsvTab() {
  return (
    <SegmentedDocumentProvider model={CSV_SEGMENTED_DOCUMENT}>
      <CsvTabContent />
    </SegmentedDocumentProvider>
  )
}

function CsvTabContent() {
  const viewerRef = React.useRef<CsvViewerHandle>(null)
  const target = useCsvSourceTarget(viewerRef)
  const link = useSourceTargetedSegmentedFieldLink({
    initialPath: CSV_FIELDS[0]?.key,
    sources: CSV_EXTRACTION.sources,
    target,
  })
  const activeCell = sourceToCsvCell(
    sourceForPath(CSV_EXTRACTION.sources, link.activePath)
  )

  return (
    <SourceLinkedViewer
      extraction={CSV_EXTRACTION}
      link={link}
      source={CSV_SOURCE}
    >
      <FileResourceCsvViewer
        ref={viewerRef}
        fillHeight
        className="h-full rounded-none border-0"
        controls={false}
        activeCell={activeCell}
      />
    </SourceLinkedViewer>
  )
}

function ExcelTab() {
  return (
    <SegmentedDocumentProvider model={XLSX_SEGMENTED_DOCUMENT}>
      <ExcelTabContent />
    </SegmentedDocumentProvider>
  )
}

function ExcelTabContent() {
  const viewerRef = React.useRef<XlsxViewerHandle>(null)
  const target = useXlsxSourceTarget(viewerRef)
  const link = useSourceTargetedSegmentedFieldLink({
    initialPath: XLSX_FIELDS[0]?.key,
    sources: XLSX_EXTRACTION.sources,
    target,
  })
  const activeCell = sourceToXlsxCell(
    sourceForPath(XLSX_EXTRACTION.sources, link.activePath)
  )

  return (
    <SourceLinkedViewer
      extraction={XLSX_EXTRACTION}
      link={link}
      source={XLSX_SOURCE}
    >
      <FileResourceXlsxViewer
        ref={viewerRef}
        bare
        className="h-full"
        controls={false}
        activeCell={activeCell}
      />
    </SourceLinkedViewer>
  )
}

function DocxTab() {
  return (
    <SegmentedDocumentProvider model={DOCX_SEGMENTED_DOCUMENT}>
      <DocxTabContent />
    </SegmentedDocumentProvider>
  )
}

function DocxTabContent() {
  const viewerRef = React.useRef<DocxViewerHandle>(null)
  const target = useDocxSourceTarget(viewerRef)
  const link = useSourceTargetedSegmentedFieldLink({
    initialPath: DOCX_FIELDS[0]?.key,
    sources: DOCX_EXTRACTION.sources,
    target,
  })
  const highlight = sourceToDocxHighlight(
    sourceForPath(DOCX_EXTRACTION.sources, link.activePath)
  )

  return (
    <SourceLinkedViewer
      extraction={DOCX_EXTRACTION}
      link={link}
      source={DOCX_SOURCE}
    >
      <FileResourceDocxViewer
        ref={viewerRef}
        bare
        className="h-full"
        controls={false}
        highlight={highlight}
      />
    </SourceLinkedViewer>
  )
}

const FileResourceImageViewer = React.forwardRef<
  ImageViewerHandle,
  React.ComponentProps<typeof ImageViewerFrames>
>(function FileResourceImageViewer(props, ref) {
  const resource = useFileViewerResource()
  return (
    <ImageViewerProvider resource={resource}>
      <ImageViewerFrames {...props} ref={ref} />
    </ImageViewerProvider>
  )
})

const FileResourceTextViewer = React.forwardRef<
  TextViewerHandle,
  React.ComponentProps<typeof TextViewerDocument>
>(function FileResourceTextViewer(props, ref) {
  const resource = useFileViewerResource()
  return (
    <TextViewerProvider resource={resource}>
      <TextViewerDocument {...props} ref={ref} />
    </TextViewerProvider>
  )
})

const FileResourceCsvViewer = React.forwardRef<
  CsvViewerHandle,
  React.ComponentProps<typeof CsvViewerGrid>
>(function FileResourceCsvViewer(props, ref) {
  const resource = useFileViewerResource()
  return (
    <CsvViewerProvider resource={resource}>
      <CsvViewerGrid {...props} ref={ref} />
    </CsvViewerProvider>
  )
})

const FileResourceXlsxViewer = React.forwardRef<
  XlsxViewerHandle,
  React.ComponentProps<typeof XlsxViewerWorkbook>
>(function FileResourceXlsxViewer(props, ref) {
  const resource = useFileViewerResource()
  return (
    <XlsxViewerProvider resource={resource}>
      <XlsxViewerWorkbook {...props} ref={ref} />
    </XlsxViewerProvider>
  )
})

const FileResourceDocxViewer = React.forwardRef<
  DocxViewerHandle,
  React.ComponentProps<typeof DocxViewerDocument>
>(function FileResourceDocxViewer(props, ref) {
  const resource = useFileViewerResource()
  return (
    <DocxViewerProvider resource={resource}>
      <DocxViewerDocument {...props} ref={ref} />
    </DocxViewerProvider>
  )
})

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
 * linked by their sources. Segmented source interaction drives every tab; only
 * the viewer and its source target adapter differ per format.
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
