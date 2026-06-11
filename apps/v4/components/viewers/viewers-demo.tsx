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
import { PdfViewer } from "@/components/ui/pdf-viewer";
import splitSample from "@/components/viewers/sample-data/split.json";
import partitionSample from "@/components/viewers/sample-data/partition.json";
import parseSample from "@/components/viewers/sample-data/parse.json";

// ── Sample data ─────────────────────────────────────────────────────────────

/** Real split result: Harris 2023 federal + state tax returns (51 subdocuments). */
const SPLIT_PDF_URL = "/samples/harris_2023_federal_state_returns.pdf";
/** Real partition result: tapstone (6 keyed chunks over 4 pages). */
const PARTITION_PDF_URL = "/samples/tapstone.pdf";

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

/** Real Retab parse: tapstone.pdf run through `retab parses create` (retab-large). */
const parseResult: ParseResponse = {
  output: parseSample.output as ParseResponse["output"],
  usage: parseSample.usage as ParseResponse["usage"],
};

const editFields: FormField[] = [
  { key: "full_name", bbox: { left: 0.1, top: 0.12, width: 0.32, height: 0.04, page: 1 }, type: "text", description: "Full name", value: "Jane Doe" },
  { key: "email", bbox: { left: 0.1, top: 0.2, width: 0.4, height: 0.04, page: 1 }, type: "text", description: "Email address", value: "jane@acme.com" },
  { key: "agree", bbox: { left: 0.1, top: 0.3, width: 0.04, height: 0.03, page: 1 }, type: "checkbox", description: "Accept terms", value: "true" },
];

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
            downloadFileName="tapstone.pdf"
            header={handlers.header}
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
            header={handlers.header}
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
            header={handlers.header}
            aside={handlers.aside}
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

export function EditViewerDemo() {
  return (
    <div className="not-prose flex flex-col overflow-hidden rounded-xl border" style={{ height: 520 }}>
      <EditViewer
        detectedFields={editFields}
        hasFilled
        hasOriginal
        renderDocument={(view) => (
          <div className="flex h-full items-center justify-center bg-muted text-sm text-muted-foreground capitalize">
            {view} document
          </div>
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
