import { describe, expect, it } from "vitest";

import { createMarkdownGreenfieldDocument } from "@/registry/new-york-v4/ui/markdown-greenfield-document";
import type { MarkdownGreenfieldDocument } from "@/registry/new-york-v4/ui/markdown-greenfield-document";
import {
  layoutMarkdownGreenfieldDocument,
  MARKDOWN_GREENFIELD_LAYOUT_POLICY_VERSION,
  type MarkdownGreenfieldMeasurementContext,
} from "@/registry/new-york-v4/ui/markdown-greenfield-layout";

describe("pretext markdown greenfield layout", () => {
  it("caches immutable layout frames by document, width, scale, and measurements", () => {
    const document = createMarkdownGreenfieldDocument(
      [
        "# Cached Layout",
        "",
        ...Array.from(
          { length: 80 },
          (_, index) => `Paragraph ${index + 1} with enough text to estimate.`,
        ),
      ].join("\n"),
    );
    const first = layoutMarkdownGreenfieldDocument({
      contentWidth: 820,
      document,
      fontScale: 1,
    });
    const second = layoutMarkdownGreenfieldDocument({
      contentWidth: 820,
      document,
      fontScale: 1,
    });
    const scaled = layoutMarkdownGreenfieldDocument({
      contentWidth: 820,
      document,
      fontScale: 1.2,
    });

    expect(second).toBe(first);
    expect(scaled).not.toBe(first);
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.chunks)).toBe(true);
    expect(Object.isFrozen(first.chunks[0])).toBe(true);
    expect(() => {
      (first.chunks as unknown[]).push(first.chunks[0]);
    }).toThrow();
  });

  it("invalidates cached layout frames when measured heights change", () => {
    const document = createMarkdownGreenfieldDocument(
      ["# Measured", "", "A paragraph.", "", "## Later", "", "More."].join(
        "\n",
      ),
    );
    const measuredHeights = new Map<string, number>();
    let measuredHeightsRevision = 0;
    const lookup = {
      get cacheKey() {
        return `revision-${measuredHeightsRevision}`;
      },
      get(
        chunk: { id: string },
        context: MarkdownGreenfieldMeasurementContext,
      ) {
        expect(context.policyVersion).toBe(
          MARKDOWN_GREENFIELD_LAYOUT_POLICY_VERSION,
        );
        return measuredHeights.get(chunk.id);
      },
    };

    measuredHeights.set(document.chunks[0]!.id, 120);
    const first = layoutMarkdownGreenfieldDocument({
      contentWidth: 720,
      document,
      fontScale: 1,
      measuredHeights: lookup,
    });
    const second = layoutMarkdownGreenfieldDocument({
      contentWidth: 720,
      document,
      fontScale: 1,
      measuredHeights: lookup,
    });

    measuredHeights.set(document.chunks[0]!.id, 180);
    measuredHeightsRevision += 1;
    const changed = layoutMarkdownGreenfieldDocument({
      contentWidth: 720,
      document,
      fontScale: 1,
      measuredHeights: lookup,
    });

    expect(second).toBe(first);
    expect(changed).not.toBe(first);
    expect(first.chunks[0]?.measuredHeight).toBe(120);
    expect(changed.chunks[0]?.measuredHeight).toBe(180);
  });

  it("does not serialize detailed measured heights when no compact revision is provided", () => {
    const document = createMarkdownGreenfieldDocument(
      ["# Uncached", "", "A paragraph."].join("\n"),
    );
    const measuredHeights = new Map<string, number>();
    const lookup = {
      get(chunk: { id: string }) {
        return measuredHeights.get(chunk.id);
      },
    };

    measuredHeights.set(document.chunks[0]!.id, 120);
    const first = layoutMarkdownGreenfieldDocument({
      contentWidth: 720,
      document,
      fontScale: 1,
      measuredHeights: lookup,
    });
    const second = layoutMarkdownGreenfieldDocument({
      contentWidth: 720,
      document,
      fontScale: 1,
      measuredHeights: lookup,
    });

    measuredHeights.set(document.chunks[0]!.id, 180);
    const changed = layoutMarkdownGreenfieldDocument({
      contentWidth: 720,
      document,
      fontScale: 1,
      measuredHeights: lookup,
    });

    expect(second).not.toBe(first);
    expect(changed).not.toBe(second);
    expect(changed.chunks[0]?.measuredHeight).toBe(180);
  });

  it("reuses static chunk estimates across measurement revisions", () => {
    let estimateReads = 0;
    const document = createEstimatedHeightProbeDocument(() => {
      estimateReads += 1;
    });
    const measuredHeights = new Map<string, number>();

    layoutMarkdownGreenfieldDocument({
      contentWidth: 720,
      document,
      fontScale: 1,
      measuredHeights: {
        cacheKey: "revision-0",
        get: (chunk) => measuredHeights.get(chunk.id),
      },
    });
    measuredHeights.set(document.chunks[0]!.id, 180);
    const measured = layoutMarkdownGreenfieldDocument({
      contentWidth: 720,
      document,
      fontScale: 1,
      measuredHeights: {
        cacheKey: "revision-1",
        get: (chunk) => measuredHeights.get(chunk.id),
      },
    });

    expect(estimateReads).toBe(1);
    expect(measured.chunks[0]?.measuredHeight).toBe(180);
  });
});

function createEstimatedHeightProbeDocument(
  onEstimateRead: () => void,
): MarkdownGreenfieldDocument {
  const sourceLineLengths = {
    reduce<T>(
      callback: (previous: T, current: number, index: number) => T,
      initialValue: T,
    ) {
      onEstimateRead();
      return [160, 120].reduce(callback, initialValue);
    },
  } as unknown as readonly number[];

  return {
    blocks: [
      {
        hastChildren: [],
        id: "block-0",
        index: 0,
        isGenerated: false,
        isHostile: false,
        kind: "paragraph",
        sourceLineCount: 2,
        sourceLineLengths,
        sourceRange: null,
        sourceText: "A long paragraph.\nAnother long paragraph.",
      },
    ],
    chunks: [
      {
        blockIds: ["block-0"],
        hastChildren: [],
        id: "chunk-0",
        index: 0,
        isHostile: false,
        nativeFindText: "A long paragraph. Another long paragraph.",
        sourceEndLine: 2,
        sourceLineCount: 2,
        sourceRange: null,
        sourceStartLine: 1,
        sourceText: "A long paragraph.\nAnother long paragraph.",
      },
    ],
    fragmentTargets: [],
    headings: [],
    lineCount: 2,
    text: "A long paragraph.\nAnother long paragraph.",
    unified: {} as MarkdownGreenfieldDocument["unified"],
    wordCount: 6,
  };
}
