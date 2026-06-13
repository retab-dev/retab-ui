"use client"

import { PdfViewer } from "@/components/ui/pdf-viewer"
import { EmailViewerDemo } from "@/components/email-viewer-demo"
import { TextViewerDemo } from "@/components/text-viewer-demo"
import { ClassifierViewer } from "@/components/viewers/classify/classifier-viewer"
import { EditViewer } from "@/components/viewers/edit/edit-viewer"
import type { FormField } from "@/components/viewers/lib/edit-types"
import type { ParseResponse } from "@/components/viewers/lib/parse-types"
import type { PartitionResult } from "@/components/viewers/lib/partition-types"
import type { SplitView } from "@/components/viewers/lib/split-types"
import { ParseViewer } from "@/components/viewers/parse/parse-viewer"
import { PartitionViewer } from "@/components/viewers/partition/partition-viewer"
import editSample from "@/components/viewers/sample-data/edit.json"
import parseSample from "@/components/viewers/sample-data/parse.json"
import partitionSample from "@/components/viewers/sample-data/partition.json"
import splitSample from "@/components/viewers/sample-data/split.json"
import { SplitViewer } from "@/components/viewers/split/split-viewer"
import { ExtractViewerBlock } from "@/registry/new-york-v4/blocks/extract-viewer-block"
import { JsonFormSourcesBlock } from "@/registry/new-york-v4/blocks/json-form-sources-block"

// ── Sample data ─────────────────────────────────────────────────────────────

/** Real split result: Harris 2023 federal + state tax returns (51 subdocuments). */
const SPLIT_PDF_URL = "/samples/harris_2023_federal_state_returns.pdf"
/** Real partition result: ViT paper partitioned by section (8 keyed chunks over 22 pages). */
const PARTITION_PDF_URL = "/samples/an-image-is-worth-16x16-words.pdf"

const partitionResult: PartitionResult = {
  output: partitionSample.output as PartitionResult["output"],
  consensus: {
    choices: (partitionSample.consensus?.choices ??
      []) as PartitionResult["consensus"]["choices"],
    likelihoods: null,
  },
  usage: null,
}

const splitResult: SplitView = {
  output: splitSample.output as SplitView["output"],
  consensus: { choices: [] },
  usage: null,
}

/** Parse result: the bank-statement sample as per-page markdown (transactions reconstructed as a table). */
const parseResult: ParseResponse = {
  output: parseSample.output as ParseResponse["output"],
  usage: parseSample.usage as ParseResponse["usage"],
}

const multiPageParsePageCount = 36
const multiPageParsePages = Array.from(
  { length: multiPageParsePageCount },
  (_, index) => createParseDemoPage(index + 1, multiPageParsePageCount)
)

const multiPageParseResult: ParseResponse = {
  output: {
    pages: multiPageParsePages,
    text: multiPageParsePages.join("\n\n"),
  },
  usage: { credits: 4 },
}

const largeParsePageCount = 1000
const largeParsePages = Array.from(
  { length: largeParsePageCount },
  (_, index) => createParseDemoPage(index + 1, largeParsePageCount)
)

const largeParseResult: ParseResponse = {
  document: { id: "large-parse-demo" },
  output: {
    pages: largeParsePages,
    text: largeParsePages.join("\n\n"),
  },
  usage: { credits: 100 },
}

/**
 * Real edit result: a Fidelity "Bank Wire Authorization" form filled from a
 * saved template (29 detected fields across 3 pages, normalized bbox anchors).
 */
const EDIT_PDF_URL = "/samples/fidelity-edit/fidelity_original.pdf"
const EDIT_FILLED_PDF_URL = "/samples/fidelity-edit/fidelity_filled.pdf"
const editFields = editSample as FormField[]

function FakeDocument({
  onCurrentPageChange,
  onScrollProgressChange,
}: {
  onCurrentPageChange: (pageNumber: number) => void
  onScrollProgressChange?: (progress: number) => void
}) {
  return (
    <div
      className="h-full overflow-auto bg-muted p-4"
      onScroll={(e) => {
        const el = e.currentTarget
        const progress = el.scrollTop / (el.scrollHeight - el.clientHeight || 1)
        onScrollProgressChange?.(progress)
        onCurrentPageChange(Math.max(1, Math.round(progress * 6)))
      }}
    >
      {Array.from({ length: 6 }, (_, i) => (
        <div
          key={i}
          data-page-number={i + 1}
          className="mx-auto mb-4 flex aspect-[3/4] w-64 items-center justify-center rounded border bg-background text-sm text-muted-foreground shadow-sm"
        >
          Page {i + 1}
        </div>
      ))}
    </div>
  )
}

// ── Per-viewer demos (used by the docs MDX pages) ───────────────────────────

export function PartitionViewerDemo() {
  return (
    <div
      className="not-prose flex flex-col overflow-hidden rounded-xl border"
      style={{ height: 640 }}
    >
      <PartitionViewer
        result={partitionResult}
        renderDocument={(handlers) => (
          <PdfViewer
            source={{
              kind: "url",
              url: PARTITION_PDF_URL,
              fileName: "an-image-is-worth-16x16-words.pdf",
            }}
            bare
            slots={handlers.slots}
            onVisiblePageChange={handlers.onCurrentPageChange}
            onScrollProgressChange={handlers.onScrollProgressChange}
            className="h-full"
          />
        )}
      />
    </div>
  )
}

export function ClassificationViewerDemo() {
  return (
    <div
      className="not-prose flex flex-col overflow-hidden rounded-xl border"
      style={{ height: 520 }}
    >
      <ClassifierViewer
        result={{
          category: "Loan Application",
          reasoning:
            "The document is a Uniform Residential Loan Application (Form 1003): it collects borrower, employment, and property details for a mortgage request, which matches the Loan Application category.",
        }}
        renderDocument={(handlers) => (
          <PdfViewer
            source={{
              kind: "url",
              url: "/samples/loan-application.pdf",
              fileName: "loan-application.pdf",
            }}
            bare
            slots={handlers.slots}
            className="h-full"
          />
        )}
      />
    </div>
  )
}

export function SplitViewerDemo() {
  return (
    <div
      className="not-prose flex flex-col overflow-hidden rounded-xl border"
      style={{ height: 640 }}
    >
      <SplitViewer
        result={splitResult}
        renderDocument={(handlers) => (
          <PdfViewer
            ref={handlers.setViewerHandle}
            source={{
              kind: "url",
              url: SPLIT_PDF_URL,
              fileName: "harris_2023_federal_state_returns.pdf",
            }}
            bare
            slots={handlers.slots}
            onVisiblePageChange={handlers.onCurrentPageChange}
            onScrollProgressChange={handlers.onScrollProgressChange}
            className="h-full"
          />
        )}
      />
    </div>
  )
}

export function ParseViewerDemo() {
  // The raw parse renderer on its own — extracted markdown (Rendered/Text), no
  // source document. The side-by-side composition lives on /blocks (Primitives).
  return (
    <div
      className="not-prose flex flex-col overflow-hidden rounded-xl border"
      style={{ height: 680 }}
    >
      <ParseViewer result={multiPageParseResult} />
    </div>
  )
}

export function LargeParseViewerDemo() {
  return (
    <div
      data-slot="large-parse-viewer-demo"
      className="not-prose flex flex-col overflow-hidden rounded-xl border"
      style={{ height: 680 }}
    >
      <ParseViewer result={largeParseResult} />
    </div>
  )
}

export function ExtractViewerDemo() {
  // Extracted fields linked to their sources in the PDF — hover/select a field
  // to highlight where its value came from and scroll the page to it.
  return (
    <div
      className="not-prose flex flex-col overflow-hidden rounded-xl border"
      style={{ height: 680 }}
    >
      <ExtractViewerBlock />
    </div>
  )
}

export function JsonFormSourcesDemo() {
  // Extraction rendered as a JSON form beside the source PDF — hover a form field
  // to highlight where its value came from. json-form ⨯ pdf-viewer via useSourceLink.
  return (
    <div
      className="not-prose flex flex-col overflow-hidden rounded-xl border"
      style={{ height: 680 }}
    >
      <JsonFormSourcesBlock />
    </div>
  )
}

export function EditViewerDemo() {
  // Detected form fields beside the source document — select or hover a field to
  // highlight its region on the page; the Preview mode stamps field values as an
  // overlay distinct from the generated filled document.
  return (
    <div
      className="not-prose flex flex-col overflow-hidden rounded-xl border"
      style={{ height: 680 }}
    >
      <EditViewer
        result={{ fields: editFields }}
        sourceDocument={{
          src: EDIT_PDF_URL,
          mimeType: "application/pdf",
          filename: "fidelity-bank-wire-authorization.pdf",
        }}
        filledDocument={{
          src: EDIT_FILLED_PDF_URL,
          mimeType: "application/pdf",
          filename: "fidelity-bank-wire-authorization-filled.pdf",
        }}
      />
    </div>
  )
}

/** All viewers in one page (used by the /viewers-preview route). */
export function ViewersDemo() {
  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Email viewer</h2>
        <EmailViewerDemo />
      </section>
      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Text viewer</h2>
        <TextViewerDemo />
      </section>
      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Partition viewer</h2>
        <PartitionViewerDemo />
      </section>
      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Classifier viewer</h2>
        <ClassificationViewerDemo />
      </section>
      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Parse viewer</h2>
        <ParseViewerDemo />
      </section>
      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Edit viewer</h2>
        <EditViewerDemo />
      </section>
      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Split viewer</h2>
        <SplitViewerDemo />
      </section>
    </div>
  )
}

function createParseDemoPage(pageNumber: number, pageCount: number) {
  const invoiceNumber = String(2400 + pageNumber).padStart(5, "0")
  const subtotal = 1200 + pageNumber * 47
  const tax = Math.round(subtotal * 0.0825)
  const total = subtotal + tax
  const status =
    pageNumber % 5 === 0
      ? "Needs review"
      : pageNumber % 3 === 0
        ? "Exception noted"
        : "Matched"
  const rows = Array.from({ length: 8 }, (_, rowIndex) => {
    const quantity = 1 + ((pageNumber + rowIndex) % 4)
    const unitPrice = 42 + pageNumber + rowIndex * 9
    const amount = quantity * unitPrice
    return `| SKU-${pageNumber}-${rowIndex + 1} | Service line ${rowIndex + 1} | ${quantity} | $${unitPrice.toFixed(2)} | $${amount.toFixed(2)} |`
  })

  return [
    `# Parsed Invoice ${invoiceNumber}`,
    "",
    `Page ${pageNumber} of ${pageCount} · Batch RET-${String(9000 + pageNumber)} · ${status}`,
    "",
    "## Header Fields",
    "",
    "| Field | Extracted value | Confidence |",
    "| --- | --- | ---: |",
    `| Vendor | Northwind Field Operations ${pageNumber % 7 || 7} | ${formatConfidence(0.94, pageNumber)} |`,
    `| Invoice date | 2026-06-${String((pageNumber % 27) + 1).padStart(2, "0")} | ${formatConfidence(0.91, pageNumber)} |`,
    `| Due date | 2026-07-${String((pageNumber % 24) + 1).padStart(2, "0")} | ${formatConfidence(0.89, pageNumber)} |`,
    `| Purchase order | PO-${String(70000 + pageNumber * 13)} | ${formatConfidence(0.96, pageNumber)} |`,
    "",
    "## Line Items",
    "",
    "| Code | Description | Qty | Unit price | Amount |",
    "| --- | --- | ---: | ---: | ---: |",
    ...rows,
    "",
    "## Totals",
    "",
    "| Description | Amount |",
    "| --- | ---: |",
    `| Subtotal | $${subtotal.toFixed(2)} |`,
    `| Tax | $${tax.toFixed(2)} |`,
    `| Total | $${total.toFixed(2)} |`,
    "",
    "## Notes",
    "",
    pageNumber % 4 === 0
      ? "> The parser preserved a wrapped approval note and marked the continuation as page-local context."
      : "All required fields were found on this page. The original line breaks were normalized for readability.",
    "",
    "- [x] Header detected",
    "- [x] Totals reconciled",
    pageNumber % 5 === 0
      ? "- [ ] Human review requested for address block"
      : "- [x] No manual review requested",
    "",
    "```json",
    JSON.stringify(
      {
        page: pageNumber,
        invoice_number: invoiceNumber,
        status,
        total,
      },
      null,
      2
    ),
    "```",
  ].join("\n")
}

function formatConfidence(base: number, pageNumber: number) {
  return `${Math.min(0.99, base + (pageNumber % 5) * 0.007).toFixed(3)}`
}
