import azureOutput from "@/sample/azure-output.json";
import documentAiOutput from "@/sample/documentai-output.json";
import textractOutput from "@/sample/textract-output.json";
import { describe, expect, it } from "vitest";

import {
  azureToLayoutDocument,
  type AzureDocument,
} from "@/registry/new-york-v4/ui/layout-blocks-azure";
import {
  documentAiToLayoutDocument,
  type DocumentAiDocument,
} from "@/registry/new-york-v4/ui/layout-blocks-document-ai";
import { createLayoutItemIndex } from "@/registry/new-york-v4/ui/layout-blocks-index";
import { createLayoutBlocksViewerModel } from "@/registry/new-york-v4/ui/layout-blocks-model";
import { createOcrSegmentedDocumentModel } from "@/registry/new-york-v4/ui/layout-blocks-segmented-document-model";
import {
  textractToLayoutDocument,
  type TextractDocument,
} from "@/registry/new-york-v4/ui/layout-blocks-textract";
import type {
  LayoutDocument,
  LayoutLevel,
} from "@/registry/new-york-v4/ui/layout-blocks-types";

const textractFixture = textractOutput as TextractDocument;
const azureFixture = azureOutput as AzureDocument;
const DOCUMENT_AI_PAGE_COUNT = 15;
const DOCUMENT_AI_PAGE_WIDTH = 1681;
const DOCUMENT_AI_PAGE_HEIGHT = 2378;
const DOCUMENT_AI_BLOCK_COUNT = 625;
const DOCUMENT_AI_PARAGRAPH_COUNT = 667;
const DOCUMENT_AI_LINE_COUNT = 1030;
const DOCUMENT_AI_WORD_COUNT = 9612;

describe("AWS Textract layout blocks", () => {
  it("normalizes generated Document AI pages, blocks, lines, and words", () => {
    const document = textractToLayoutDocument(textractFixture);

    expect(document.pages).toHaveLength(DOCUMENT_AI_PAGE_COUNT);
    expect(document.pages[0]).toMatchObject({
      pageNumber: 1,
      width: DOCUMENT_AI_PAGE_WIDTH,
      height: DOCUMENT_AI_PAGE_HEIGHT,
      rotation: 0,
    });
    expect(document.items.filter((i) => i.level === "block")).toHaveLength(
      DOCUMENT_AI_BLOCK_COUNT,
    );
    expect(document.items.filter((i) => i.level === "line")).toHaveLength(
      DOCUMENT_AI_LINE_COUNT,
    );
    expect(document.items.filter((i) => i.level === "word")).toHaveLength(
      DOCUMENT_AI_WORD_COUNT,
    );
  });

  it("converts Textract 0–100 confidence onto a 0–1 scale", () => {
    const document = textractToLayoutDocument(textractFixture);
    const word = document.items.find((i) => i.level === "word")!;

    expect(word.confidence).toBeGreaterThan(0);
    expect(word.confidence).toBeLessThanOrEqual(1);
    expect(
      document.items.every(
        (i) => i.confidence == null || (i.confidence >= 0 && i.confidence <= 1),
      ),
    ).toBe(true);
  });

  it("rebuilds the WORD → LINE hierarchy from CHILD relationships", () => {
    const document = textractToLayoutDocument(textractFixture);
    const index = createLayoutItemIndex(document);
    const word = document.items.find((i) => i.level === "word")!;
    const parent = word.parentId
      ? index.itemsById.get(word.parentId)
      : undefined;

    expect(parent?.level).toBe("line");
    expect(parent?.text).toContain(word.text);
  });

  it("projects normalized geometry inside the generated page bounds", () => {
    const document = textractToLayoutDocument(textractFixture);

    for (const item of document.items) {
      const page = document.pages.find(
        (candidate) => candidate.pageNumber === item.pageNumber,
      )!;
      expect(item.rect).toBeDefined();
      expect(item.rect!.left).toBeGreaterThanOrEqual(0);
      expect(item.rect!.top).toBeGreaterThanOrEqual(0);
      expect(item.rect!.left + item.rect!.width).toBeLessThanOrEqual(
        page.width + 0.001,
      );
      expect(item.rect!.top + item.rect!.height).toBeLessThanOrEqual(
        page.height + 0.001,
      );
    }
  });

  it("maps LAYOUT_* blocks to the block level with assembled text", () => {
    const withLayout: TextractDocument = {
      DocumentMetadata: { Pages: 1 },
      Blocks: [
        {
          BlockType: "LAYOUT_TITLE",
          Id: "layout-1",
          Page: 1,
          Geometry: {
            BoundingBox: { Left: 0.1, Top: 0.1, Width: 0.5, Height: 0.05 },
          },
          Relationships: [{ Type: "CHILD", Ids: ["line-1"] }],
        },
        {
          BlockType: "LINE",
          Id: "line-1",
          Page: 1,
          Text: "Quarterly Report",
          Confidence: 99,
          Geometry: {
            BoundingBox: { Left: 0.1, Top: 0.1, Width: 0.5, Height: 0.05 },
          },
        },
      ],
    };
    const document = textractToLayoutDocument(withLayout);
    const block = document.items.find((i) => i.level === "block");

    expect(block?.kind).toBe("title");
    expect(block?.text).toBe("Quarterly Report");
  });
});

describe("Azure Document Intelligence layout blocks", () => {
  it("normalizes generated Document AI paragraphs, lines, and words", () => {
    const document = azureToLayoutDocument(azureFixture);

    expect(document.pages).toHaveLength(DOCUMENT_AI_PAGE_COUNT);
    expect(document.items.filter((i) => i.level === "block")).toHaveLength(
      DOCUMENT_AI_PARAGRAPH_COUNT,
    );
    expect(document.items.filter((i) => i.level === "line")).toHaveLength(
      DOCUMENT_AI_LINE_COUNT,
    );
    expect(document.items.filter((i) => i.level === "word")).toHaveLength(
      DOCUMENT_AI_WORD_COUNT,
    );
  });

  it("keeps generated pixel page units in the source coordinate space", () => {
    const document = azureToLayoutDocument(azureFixture);
    const page = document.pages[0]!;

    expect(page.width).toBe(DOCUMENT_AI_PAGE_WIDTH);
    expect(page.height).toBe(DOCUMENT_AI_PAGE_HEIGHT);
  });

  it("carries the full content buffer and maps paragraph roles to kinds", () => {
    const document = azureToLayoutDocument(azureFixture);
    const title = document.items.find(
      (i) => i.level === "block" && i.kind === "title",
    );

    expect(document.text.startsWith("arXiv:1412.6980v9")).toBe(true);
    expect(title?.kind).toBe("title");
    expect(title?.text).toBe("ADAM: A METHOD FOR STOCHASTIC OPTIMIZATION\n");
  });

  it("derives word → line → block hierarchy from spans", () => {
    const document = azureToLayoutDocument(azureFixture);
    const index = createLayoutItemIndex(document);
    const word = document.items.find((i) => i.level === "word")!;
    const line = word.parentId ? index.itemsById.get(word.parentId) : undefined;
    const block = line?.parentId
      ? index.itemsById.get(line.parentId)
      : undefined;

    expect(line?.level).toBe("line");
    expect(block?.level).toBe("block");
  });

  it("accepts a bare analyzeResult without the operation envelope", () => {
    const bare = (azureFixture as { analyzeResult: unknown })
      .analyzeResult as AzureDocument;
    const document = azureToLayoutDocument(bare);

    expect(document.items.filter((i) => i.level === "word")).toHaveLength(
      DOCUMENT_AI_WORD_COUNT,
    );
  });
});

// Mirrors the adaptive level selection in the viewer: inspect the coarsest
// level a provider actually produces so every source has rows to review.
const LEVEL_ORDER: LayoutLevel[] = ["block", "paragraph", "line", "word"];
function inspectedLevel(document: LayoutDocument): LayoutLevel {
  for (const level of LEVEL_ORDER) {
    if (document.items.some((item) => item.level === level)) return level;
  }
  return "block";
}

describe("OCR viewer pipeline across providers", () => {
  const cases: {
    name: string;
    document: LayoutDocument;
    level: LayoutLevel;
  }[] = [
    {
      name: "Google Document AI",
      document: documentAiToLayoutDocument(
        documentAiOutput as DocumentAiDocument,
      ),
      level: "block",
    },
    {
      name: "AWS Textract",
      document: textractToLayoutDocument(textractFixture),
      level: "block",
    },
    {
      name: "Azure Document Intelligence",
      document: azureToLayoutDocument(azureFixture),
      level: "block",
    },
  ];

  it.each(cases)(
    "builds a non-empty viewer + segmented model for $name",
    ({ document, level }) => {
      expect(inspectedLevel(document)).toBe(level);

      const model = createLayoutBlocksViewerModel({
        document,
        levels: [level],
        threshold: 0.9,
      });
      expect(model.visibleItems.length).toBeGreaterThan(0);
      expect(model.evidenceItems.length).toBe(model.visibleItems.length);
      // Every visible item resolves to a page anchor (geometry is valid).
      expect(
        model.evidenceItems.every((item) => item.anchor.status === "resolved"),
      ).toBe(true);

      const segmented = createOcrSegmentedDocumentModel({
        document,
        items: model.visibleItems,
      });
      expect(segmented.segments.length).toBe(model.visibleItems.length);
      expect(segmented.pages.length).toBe(document.pages.length);
    },
  );
});
