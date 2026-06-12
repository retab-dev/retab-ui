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
  useSourceLink,
  type UseSourceLinkResult,
} from "@/hooks/use-source-link"
import { sourceToCsvCell, useCsvSourceTarget } from "@/components/ui/csv-source"
import { CsvViewer, type CsvViewerHandle } from "@/components/ui/csv-viewer"
import {
  sourceToDocxHighlight,
  useDocxSourceTarget,
} from "@/components/ui/docx-source"
import { DocxViewer, type DocxViewerHandle } from "@/components/ui/docx-viewer"
import {
  renderImageSourceOverlay,
  useImageSourceTarget,
} from "@/components/ui/image-source"
import {
  ImageViewer,
  type ImageViewerHandle,
} from "@/components/ui/image-viewer"
import {
  renderPdfSourceOverlay,
  usePdfSourceTarget,
} from "@/components/ui/pdf-source"
import { PdfViewer, type PdfViewerHandle } from "@/components/ui/pdf-viewer"
import { ScrollArea } from "@/components/ui/scroll-area"
import { SourceIndicator } from "@/components/ui/source-indicator"
import {
  sourceToTextHighlight,
  useTextSourceTarget,
} from "@/components/ui/text-source"
import { TextViewer, type TextViewerHandle } from "@/components/ui/text-viewer"
import {
  sourceToXlsxCell,
  useXlsxSourceTarget,
} from "@/components/ui/xlsx-source"
import { XlsxViewer, type XlsxViewerHandle } from "@/components/ui/xlsx-viewer"
import { JsonForm } from "@/components/json-form/json-form"
import csvSample from "@/components/viewers/sample-data/csv-sources.json"
import docxSample from "@/components/viewers/sample-data/docx-sources.json"
import imageSample from "@/components/viewers/sample-data/image-sources.json"
import jsonFormSample from "@/components/viewers/sample-data/json-form-sources.json"
import textSample from "@/components/viewers/sample-data/text-sources.json"
import xlsxSample from "@/components/viewers/sample-data/xlsx-sources.json"

// ── Sample sources, one per file format ───────────────────────────────────────

const PDF_URL = "/samples/bank-statement-x4uhhi7t.pdf"
const IMAGE_URL = "/samples/attention-page-1.png"
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
  schema: JSONSchema7
  values: Record<string, unknown>
  sources: SourceMap
}

// Build a JSON form's three inputs (schema, values, source map) from a flat
// field array, so every format renders the same json-form panel. The schema
// property names match the source-map keys, which are the paths json-form emits
// on hover — so the source link resolves without any per-format wiring.
function flatExtraction(fields: FlatField[]): Extraction {
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
    sources: Object.fromEntries(
      fields.map((field) => [field.key, field.source])
    ),
  }
}

// The PDF tab uses the richer, nested extraction sample (a real /sources
// response); the rest derive a flat form from their per-format field arrays.
const PDF_EXTRACTION: Extraction = {
  schema: jsonFormSample.schema as JSONSchema7,
  values: jsonFormSample.extraction as Record<string, unknown>,
  sources: extractionSourcesToSourceMap(jsonFormSample.sources),
}
const IMAGE_EXTRACTION = flatExtraction(imageSample as FlatField[])
const TEXT_EXTRACTION = flatExtraction(textSample as FlatField[])
const CSV_EXTRACTION = flatExtraction(csvSample as FlatField[])
const XLSX_EXTRACTION = flatExtraction(xlsxSample as FlatField[])
const DOCX_EXTRACTION = flatExtraction(docxSample as FlatField[])

// ── Shared layout: viewer + json-form extraction panel ────────────────────────

/**
 * The extraction shell every tab shares: the source document on the left, the
 * extraction rendered as a JSON form on the right. Hovering a form field reports
 * its path to the source link, which scrolls and highlights the document; the
 * caller wires its viewer's overlay to `link.activeSource`.
 */
function ExtractionShell({
  link,
  extraction,
  children,
}: {
  link: UseSourceLinkResult
  extraction: Extraction
  children: React.ReactNode
}) {
  return (
    <div className="flex h-full bg-background">
      <div className="relative min-w-0 flex-1">
        {children}
        <SourceIndicator path={link.activePath} found={!!link.activeSource} />
      </div>
      <ExtractionForm extraction={extraction} link={link} />
    </div>
  )
}

function ExtractionForm({
  extraction,
  link,
}: {
  extraction: Extraction
  link: UseSourceLinkResult
}) {
  const form = useForm<Record<string, unknown>>({
    defaultValues: extraction.values,
  })

  // `json-form` is source-link-aware: pass the link and every field
  // becomes a hoverable card that reports its path (an RHF dot-path matching the
  // source-map keys) and highlights when active. No per-field wiring needed.
  return (
    <aside className="flex w-[420px] flex-shrink-0 flex-col border-l">
      <div className="flex h-10 flex-shrink-0 items-center gap-2 border-b px-4">
        <h2 className="text-sm font-medium">Extracted data</h2>
        <span className="ml-auto text-xs text-muted-foreground">
          Hover a field to see its source
        </span>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <div className="p-4">
          <JsonForm form={form} schema={extraction.schema} sourceLink={link} />
        </div>
      </ScrollArea>
    </aside>
  )
}

// ── Per-format tabs ───────────────────────────────────────────────────────────

function PdfTab() {
  const viewerRef = React.useRef<PdfViewerHandle>(null)
  const target = usePdfSourceTarget(viewerRef)
  const link = useSourceLink({ sources: PDF_EXTRACTION.sources, target })
  return (
    <ExtractionShell link={link} extraction={PDF_EXTRACTION}>
      <PdfViewer
        ref={viewerRef}
        source={{
          kind: "url",
          url: PDF_URL,
          fileName: "bank-statement.pdf",
        }}
        bare
        className="h-full"
        renderPageOverlay={renderPdfSourceOverlay(link.activeSource)}
      />
    </ExtractionShell>
  )
}

function ImageTab() {
  const viewerRef = React.useRef<ImageViewerHandle>(null)
  const target = useImageSourceTarget(viewerRef)
  const link = useSourceLink({ sources: IMAGE_EXTRACTION.sources, target })
  return (
    <ExtractionShell link={link} extraction={IMAGE_EXTRACTION}>
      <ImageViewer
        ref={viewerRef}
        source={{
          kind: "url",
          url: IMAGE_URL,
          fileName: "attention-page-1.png",
        }}
        bare
        className="h-full"
        renderFrameOverlay={renderImageSourceOverlay(link.activeSource)}
      />
    </ExtractionShell>
  )
}

function TextTab() {
  const viewerRef = React.useRef<TextViewerHandle>(null)
  const target = useTextSourceTarget(viewerRef)
  const link = useSourceLink({ sources: TEXT_EXTRACTION.sources, target })
  return (
    <ExtractionShell link={link} extraction={TEXT_EXTRACTION}>
      <TextViewer
        ref={viewerRef}
        source={{
          kind: "url",
          url: TEXT_URL,
          fileName: "extraction-run.log",
        }}
        bare
        className="h-full"
        highlight={sourceToTextHighlight(link.activeSource)}
      />
    </ExtractionShell>
  )
}

function CsvTab() {
  const viewerRef = React.useRef<CsvViewerHandle>(null)
  const target = useCsvSourceTarget(viewerRef)
  const link = useSourceLink({ sources: CSV_EXTRACTION.sources, target })
  return (
    <ExtractionShell link={link} extraction={CSV_EXTRACTION}>
      <CsvViewer
        ref={viewerRef}
        value={CSV_TEXT}
        fillHeight
        className="h-full rounded-none border-0"
        activeCell={sourceToCsvCell(link.activeSource)}
      />
    </ExtractionShell>
  )
}

function ExcelTab() {
  const viewerRef = React.useRef<XlsxViewerHandle>(null)
  const target = useXlsxSourceTarget(viewerRef)
  const link = useSourceLink({ sources: XLSX_EXTRACTION.sources, target })
  return (
    <ExtractionShell link={link} extraction={XLSX_EXTRACTION}>
      <XlsxViewer
        ref={viewerRef}
        src={XLSX_URL}
        bare
        downloadFileName="nvidia-financials-fy2024.xlsx"
        className="h-full"
        activeCell={sourceToXlsxCell(link.activeSource)}
      />
    </ExtractionShell>
  )
}

function DocxTab() {
  const viewerRef = React.useRef<DocxViewerHandle>(null)
  const target = useDocxSourceTarget(viewerRef)
  const link = useSourceLink({ sources: DOCX_EXTRACTION.sources, target })
  return (
    <ExtractionShell link={link} extraction={DOCX_EXTRACTION}>
      <DocxViewer
        ref={viewerRef}
        src={DOCX_URL}
        bare
        downloadFileName="quarterly-business-review.docx"
        className="h-full"
        highlight={sourceToDocxHighlight(link.activeSource)}
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
 * values, linked by their sources. The same `useSourceLink` mediator drives
 * every viewer; only the viewer + its source adapter differ per tab.
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
