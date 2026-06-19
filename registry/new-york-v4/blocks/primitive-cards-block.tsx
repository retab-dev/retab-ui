"use client"

import { toSegments } from "@/lib/segments"
import {
  ClassificationRunCard,
  ExtractRunCard,
  ParseRunCard,
  PartitionRunCard,
  SplitRunCard,
  type ExtractRunCardField,
} from "@/components/ui/primitive-run-cards"
import type { ClassifyResult } from "@/components/viewers/lib/classify-types"
import type { PartitionResult } from "@/components/viewers/lib/partition-types"
import type { SplitView } from "@/components/viewers/lib/split-types"
import extractSample from "@/components/viewers/sample-data/extract.json"
import parseSample from "@/components/viewers/sample-data/parse.json"

// ── Per-primitive sample results, each framed as a completed "run". ───────────

const CLASSIFICATION = {
  file: { name: "loan-application.pdf", type: "application/pdf" },
  thumbnail: "/samples/loan-application-page-1.png",
  result: {
    category: "Loan Application",
    reasoning:
      "A Uniform Residential Loan Application (Form 1003): borrower, employment, and property details for a mortgage request.",
  } satisfies ClassifyResult,
}

const SPLIT = {
  file: { name: "an-image-is-worth-16x16-words.pdf", type: "application/pdf" },
  thumbnail: "/samples/an-image-is-worth-16x16-words-page-1.png",
  result: {
    output: [
      { name: "Title, Abstract & Introduction", pages: [1] },
      { name: "Related Work", pages: [2] },
      { name: "Method", pages: [3] },
      { name: "Experiments", pages: [4, 5, 6, 7, 8] },
      { name: "Conclusion & References", pages: [9, 10, 11, 12] },
      { name: "Appendix", pages: [13, 14, 15, 16, 17, 18, 19, 20, 21, 22] },
    ],
  } satisfies SplitView,
}

const PARTITION = {
  file: { name: "an-image-is-worth-16x16-words.pdf", type: "application/pdf" },
  thumbnail: "/samples/an-image-is-worth-16x16-words-page-1.png",
  result: {
    output: [
      { key: "abstract", pages: [1] },
      { key: "introduction", pages: [1, 2] },
      { key: "related_work", pages: [2] },
      { key: "method", pages: [3, 4] },
      { key: "experiments", pages: [4, 5, 6, 7, 8] },
      { key: "conclusion", pages: [9] },
      { key: "references", pages: [9, 10, 11, 12] },
      { key: "appendix", pages: [13, 14, 15, 16, 17, 18, 19, 20, 21, 22] },
    ],
  } satisfies Pick<PartitionResult, "output">,
}

const PARSE = {
  file: { name: "bank-statement.pdf", type: "application/pdf" },
  markdown: (parseSample.output.pages[0] as string)
    .split("\n")
    .slice(0, 18)
    .join("\n"),
}

const EXTRACT = {
  file: { name: "bank-statement.pdf", type: "application/pdf" },
  thumbnail: "/samples/bank-statement-page-1.png",
  // The sample carries a `Source` per value (normalized pdf_bbox anchors); the
  // card tints each field and draws its source box.
  fields: extractSample as ExtractRunCardField[],
}

/**
 * Primitive run cards — each Retab primitive's result framed as a run card,
 * composing {@link ClassificationRunCard}, {@link SplitRunCard},
 * {@link PartitionRunCard}, {@link ParseRunCard}, and {@link ExtractRunCard}
 * over sample results. The cards are prop-driven, so the same components render
 * a live workflow run's per-block result.
 */
export function PrimitiveCardsBlock() {
  return (
    <div className="flex h-full min-h-[680px] flex-col bg-background">
      <div className="min-h-0 flex-1 overflow-auto p-6">
        <div className="mx-auto grid max-w-5xl grid-cols-1 items-start gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <ClassificationRunCard
            file={CLASSIFICATION.file}
            previewImageUrl={CLASSIFICATION.thumbnail}
            category={CLASSIFICATION.result.category}
            reasoning={CLASSIFICATION.result.reasoning}
          />
          <SplitRunCard
            file={SPLIT.file}
            previewImageUrl={SPLIT.thumbnail}
            segments={toSegments(SPLIT.result.output)}
          />
          <PartitionRunCard
            file={PARTITION.file}
            previewImageUrl={PARTITION.thumbnail}
            segments={toSegments(PARTITION.result.output)}
          />
          <ParseRunCard file={PARSE.file} markdown={PARSE.markdown} />
          <ExtractRunCard
            file={EXTRACT.file}
            previewImageUrl={EXTRACT.thumbnail}
            fields={EXTRACT.fields}
          />
        </div>
      </div>
    </div>
  )
}
