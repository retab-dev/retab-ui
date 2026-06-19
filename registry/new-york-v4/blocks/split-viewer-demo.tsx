"use client";

import { PdfViewer } from "@/components/ui/pdf-viewer";
import type { SplitView } from "@/components/viewers/lib/split-types";
import splitSample from "@/components/viewers/sample-data/split.json";
import {
  SplitViewer,
  useSplitViewerDocumentControls,
} from "@/components/viewers/split/split-viewer";

/** Real split result: Harris 2023 federal + state tax returns (51 subdocuments). */
const SPLIT_PDF_URL = "/samples/harris_2023_federal_state_returns.pdf";
const splitSource = {
  kind: "url" as const,
  url: SPLIT_PDF_URL,
  fileName: "harris_2023_federal_state_returns.pdf",
};

const splitResult: SplitView = {
  output: splitSample.output as SplitView["output"],
  consensus: { choices: [] },
  usage: null,
};

function SplitViewerDemoDocument() {
  const controls = useSplitViewerDocumentControls();

  return (
    <PdfViewer
      ref={controls.setDocumentHandle}
      source={splitSource}
      bare
      onVisiblePageChange={controls.onCurrentPageChange}
      onScrollProgressChange={controls.onScrollProgressChange}
      className="h-full"
    />
  );
}

export function SplitViewerExample() {
  return (
    <div
      className="not-prose flex min-h-0 flex-col overflow-hidden"
      style={{ height: 640 }}
    >
      <SplitViewer
        source={splitSource}
        result={splitResult}
        document={<SplitViewerDemoDocument />}
      />
    </div>
  );
}
