"use client";

import type { ParseResponse } from "@/components/viewers/lib/parse-types";
import { ParseViewer } from "@/components/viewers/parse/parse-viewer";

const multiPageParsePageCount = 36;
const multiPageParsePages = Array.from(
  { length: multiPageParsePageCount },
  (_, index) => createParseDemoPage(index + 1, multiPageParsePageCount),
);

const multiPageParseResult: ParseResponse = {
  output: {
    pages: multiPageParsePages,
    text: multiPageParsePages.join("\n\n"),
  },
  usage: { credits: 4 },
};

const largeParsePageCount = 1000;
const largeParsePages = Array.from(
  { length: largeParsePageCount },
  (_, index) => createParseDemoPage(index + 1, largeParsePageCount),
);

const largeParseResult: ParseResponse = {
  document: { id: "large-parse-demo" },
  output: {
    pages: largeParsePages,
    text: largeParsePages.join("\n\n"),
  },
  usage: { credits: 100 },
};

export function ParseViewerDemo() {
  return (
    <div className="flex h-[680px] min-h-0 flex-col overflow-hidden">
      <ParseViewer result={multiPageParseResult} />
    </div>
  );
}

export function LargeParseViewerDemo() {
  return (
    <div
      data-slot="large-parse-viewer-demo"
      className="flex h-[680px] min-h-0 flex-col overflow-hidden"
    >
      <ParseViewer result={largeParseResult} />
    </div>
  );
}

function createParseDemoPage(pageNumber: number, pageCount: number) {
  const invoiceNumber = String(2400 + pageNumber).padStart(5, "0");
  const subtotal = 1200 + pageNumber * 47;
  const tax = Math.round(subtotal * 0.0825);
  const total = subtotal + tax;
  const status =
    pageNumber % 5 === 0
      ? "Needs review"
      : pageNumber % 3 === 0
        ? "Exception noted"
        : "Matched";
  const rows = Array.from({ length: 8 }, (_, rowIndex) => {
    const quantity = 1 + ((pageNumber + rowIndex) % 4);
    const unitPrice = 42 + pageNumber + rowIndex * 9;
    const amount = quantity * unitPrice;
    return `| SKU-${pageNumber}-${rowIndex + 1} | Service line ${rowIndex + 1} | ${quantity} | $${unitPrice.toFixed(2)} | $${amount.toFixed(2)} |`;
  });

  return [
    `# Parsed Invoice ${invoiceNumber}`,
    "",
    `Page ${pageNumber} of ${pageCount} | Batch RET-${String(9000 + pageNumber)} | ${status}`,
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
      2,
    ),
    "```",
  ].join("\n");
}

function formatConfidence(base: number, pageNumber: number) {
  return `${Math.min(0.99, base + (pageNumber % 5) * 0.007).toFixed(3)}`;
}
