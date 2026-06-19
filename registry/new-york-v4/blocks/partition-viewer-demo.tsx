"use client";

import { PdfViewer } from "@/components/ui/pdf-viewer";
import type { PartitionResult } from "@/components/viewers/lib/partition-types";
import {
  PartitionViewer,
  usePartitionViewerDocumentControls,
} from "@/components/viewers/partition/partition-viewer";
import partitionSample from "@/components/viewers/sample-data/partition.json";

/** Real partition result: ViT paper partitioned by section (8 keyed chunks over 22 pages). */
const PARTITION_PDF_URL = "/samples/an-image-is-worth-16x16-words.pdf";
const partitionSource = {
  kind: "url" as const,
  url: PARTITION_PDF_URL,
  fileName: "an-image-is-worth-16x16-words.pdf",
};

const partitionResult: PartitionResult = {
  output: partitionSample.output as PartitionResult["output"],
  consensus: {
    choices: (partitionSample.consensus?.choices ??
      []) as PartitionResult["consensus"]["choices"],
    likelihoods: null,
  },
  usage: null,
};

function PartitionDemoDocument() {
  const controls = usePartitionViewerDocumentControls();

  return (
    <PdfViewer
      ref={controls.setDocumentHandle}
      source={partitionSource}
      bare
      onVisiblePageChange={controls.onCurrentPageChange}
      onScrollProgressChange={controls.onScrollProgressChange}
      className="h-full"
    />
  );
}

export function PartitionViewerExample() {
  return (
    <div
      className="not-prose flex min-h-0 flex-col overflow-hidden"
      style={{ height: 640 }}
    >
      <PartitionViewer
        source={partitionSource}
        result={partitionResult}
        document={<PartitionDemoDocument />}
      />
    </div>
  );
}
