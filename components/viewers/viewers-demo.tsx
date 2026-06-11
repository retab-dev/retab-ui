"use client";

import type { PartitionResult } from "@/components/viewers/lib/partition-types";
import { PartitionViewer } from "@/components/viewers/partition/partition-viewer";
import { ClassifierViewer } from "@/components/viewers/classify/classifier-viewer";
import type { SplitView } from "@/components/viewers/lib/split-types";
import { SplitViewer } from "@/components/viewers/split/split-viewer";
import type { ParseResponse } from "@/components/viewers/lib/parse-types";
import { ParseViewer } from "@/components/viewers/parse/parse-viewer";
import type { FormField } from "@/components/viewers/lib/edit-types";
import { EditViewer } from "@/components/viewers/edit/edit-viewer";
import { ExtractViewerBlock } from "@/registry/new-york-v4/blocks/extract-viewer-block";
import { JsonFormSourcesBlock } from "@/registry/new-york-v4/blocks/json-form-sources-block";
import { PdfViewer } from "@/components/ui/pdf-viewer";
import splitSample from "@/components/viewers/sample-data/split.json";
import partitionSample from "@/components/viewers/sample-data/partition.json";
import parseSample from "@/components/viewers/sample-data/parse.json";
import editSample from "@/components/viewers/sample-data/edit.json";

// ── Sample data ─────────────────────────────────────────────────────────────

/** Real split result: Harris 2023 federal + state tax returns (51 subdocuments). */
const SPLIT_PDF_URL = "/samples/harris_2023_federal_state_returns.pdf";
/** Real partition result: "Attention Is All You Need" partitioned by section (10 keyed chunks over 15 pages). */
const PARTITION_PDF_URL = "/samples/attention.pdf";

const partitionResult: PartitionResult = {
  output: partitionSample.output as PartitionResult["output"],
  consensus: {
    choices: (partitionSample.consensus?.choices ??
      []) as PartitionResult["consensus"]["choices"],
    likelihoods: null,
  },
  usage: null,
};

const splitResult: SplitView = {
  output: splitSample.output as SplitView["output"],
  consensus: { choices: [] },
  usage: null,
};

/** Parse result: the bank-statement sample as per-page markdown (transactions reconstructed as a table). */
const parseResult: ParseResponse = {
  output: parseSample.output as ParseResponse["output"],
  usage: parseSample.usage as ParseResponse["usage"],
};

/**
 * Real edit result: a Fidelity "Bank Wire Authorization" form filled from a
 * saved template (29 detected fields across 3 pages, normalized bbox anchors).
 */
const EDIT_PDF_URL = "/samples/fidelity-edit/fidelity_original.pdf";
const editFields = editSample as FormField[];

function FakeDocument({
  onCurrentPageChange,
  onScrollProgressChange,
}: {
  onCurrentPageChange: (page: number) => void;
  onScrollProgressChange?: (progress: number) => void;
}) {
  return (
    <div
      className="h-full overflow-auto bg-muted p-4"
      onScroll={(e) => {
        const el = e.currentTarget;
        const progress = el.scrollTop / (el.scrollHeight - el.clientHeight || 1);
        onScrollProgressChange?.(progress);
        onCurrentPageChange(Math.max(1, Math.round(progress * 6)));
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
  );
}

// ── Per-viewer demos (used by the docs MDX pages) ───────────────────────────

export function PartitionViewerDemo() {
  return (
    <div className="not-prose flex flex-col overflow-hidden rounded-xl border" style={{ height: 640 }}>
      <PartitionViewer
        result={partitionResult}
        renderDocument={(handlers) => (
          <PdfViewer
            src={PARTITION_PDF_URL}
            bare
            downloadFileName="attention.pdf"
            slots={handlers.slots}
            onVisiblePageChange={handlers.onCurrentPageChange}
            onScrollProgressChange={handlers.onScrollProgressChange}
            className="h-full"
          />
        )}
      />
    </div>
  );
}

export function ClassificationViewerDemo() {
  return (
    <div className="not-prose flex flex-col overflow-hidden rounded-xl border" style={{ height: 520 }}>
      <ClassifierViewer
        result={{
          category: "Loan Application",
          reasoning:
            "The document is a Uniform Residential Loan Application (Form 1003): it collects borrower, employment, and property details for a mortgage request, which matches the Loan Application category.",
        }}
        renderDocument={(handlers) => (
          <PdfViewer
            src="/samples/loan-application.pdf"
            bare
            downloadFileName="loan-application.pdf"
            slots={handlers.slots}
            className="h-full"
          />
        )}
      />
    </div>
  );
}

export function SplitViewerDemo() {
  return (
    <div className="not-prose flex flex-col overflow-hidden rounded-xl border" style={{ height: 640 }}>
      <SplitViewer
        result={splitResult}
        renderDocument={(handlers) => (
          <PdfViewer
            src={SPLIT_PDF_URL}
            bare
            downloadFileName="harris_2023_federal_state_returns.pdf"
            slots={handlers.slots}
            onVisiblePageChange={handlers.onCurrentPageChange}
            onScrollProgressChange={handlers.onScrollProgressChange}
            className="h-full"
          />
        )}
      />
    </div>
  );
}

export function ParseViewerDemo() {
  // The raw parse renderer on its own — extracted markdown (Rendered/Text), no
  // source document. The side-by-side composition lives on /blocks (Primitives).
  return (
    <div className="not-prose flex flex-col overflow-hidden rounded-xl border" style={{ height: 480 }}>
      <ParseViewer result={parseResult} />
    </div>
  );
}

export function ExtractViewerDemo() {
  // Extracted fields linked to their sources in the PDF — hover/select a field
  // to highlight where its value came from and scroll the page to it.
  return (
    <div className="not-prose flex flex-col overflow-hidden rounded-xl border" style={{ height: 680 }}>
      <ExtractViewerBlock />
    </div>
  );
}

export function JsonFormSourcesDemo() {
  // Extraction rendered as a JSON form beside the source PDF — hover a form field
  // to highlight where its value came from. json-form ⨯ pdf-viewer via useSourceLink.
  return (
    <div className="not-prose flex flex-col overflow-hidden rounded-xl border" style={{ height: 680 }}>
      <JsonFormSourcesBlock />
    </div>
  );
}

export function EditViewerDemo() {
  // Filled form fields beside the source document — select or hover a field to
  // highlight its region on the page; toggle Original/Filled to stamp the values.
  return (
    <div className="not-prose flex flex-col overflow-hidden rounded-xl border" style={{ height: 680 }}>
      <EditViewer
        detectedFields={editFields}
        hasFilled
        hasOriginal
        renderDocument={({ viewerRef, renderPageOverlay }) => (
          <PdfViewer
            ref={viewerRef}
            src={EDIT_PDF_URL}
            bare
            downloadFileName="fidelity-bank-wire-authorization.pdf"
            className="h-full"
            renderPageOverlay={renderPageOverlay}
          />
        )}
      />
    </div>
  );
}

/** All viewers in one page (used by the /viewers-preview route). */
export function ViewersDemo() {
  return (
    <div className="flex flex-col gap-8">
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
  );
}
