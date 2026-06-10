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

const parseResult: ParseResponse = {
  output: {
    pages: [
      "# Invoice — Acme Corp\n\n**Invoice** #INV-1024\nDate: 2026-05-01\n\n| Item | Qty | Price |\n| --- | --- | --- |\n| Widget | 3 | $1,280.50 |",
      "## Terms\n\nNet 30. Thank you for your business.",
    ],
    text: "Invoice — Acme Corp ...",
  },
  usage: null,
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
      className="h-full overflow-auto bg-zinc-50 p-4"
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
          className="mx-auto mb-4 flex aspect-[3/4] w-64 items-center justify-center rounded border bg-white text-sm text-zinc-400 shadow-sm"
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
            onVisiblePageChange={handlers.onCurrentPageChange}
            className="h-full"
          />
        )}
      />
    </div>
  );
}

export function ClassificationViewerDemo() {
  return (
    <div className="not-prose flex flex-col overflow-hidden rounded-xl border" style={{ height: 360 }}>
      <ClassifierViewer
        result={{
          category: "Invoice",
          reasoning:
            "The document contains an invoice number, line items, and a total due, which matches the Invoice category.",
        }}
        documentInput={{
          type: "text",
          fileBuffer: null,
          fileName: null,
          fileMimeType: "",
          textValue:
            "Invoice #INV-1024\nVendor: Acme Corp\nWidget x 3 — $1,280.50\nNet 30.",
        }}
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
            onVisiblePageChange={handlers.onCurrentPageChange}
            className="h-full"
          />
        )}
      />
    </div>
  );
}

export function ParseViewerDemo() {
  return (
    <div className="not-prose flex flex-col overflow-hidden rounded-xl border" style={{ height: 420 }}>
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
          <div className="flex h-full items-center justify-center bg-zinc-50 text-sm text-zinc-400 capitalize">
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
