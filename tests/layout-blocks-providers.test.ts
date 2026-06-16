import azureOutput from "@/sample/azure-output.json"
import documentAiOutput from "@/sample/documentai-output.json"
import textractOutput from "@/sample/textract-output.json"
import { describe, expect, it } from "vitest"

import {
  azureToLayoutDocument,
  type AzureDocument,
} from "@/registry/new-york-v4/ui/layout-blocks-azure"
import {
  documentAiToLayoutDocument,
  type DocumentAiDocument,
} from "@/registry/new-york-v4/ui/layout-blocks-document-ai"
import { createLayoutItemIndex } from "@/registry/new-york-v4/ui/layout-blocks-index"
import { createLayoutBlocksViewerModel } from "@/registry/new-york-v4/ui/layout-blocks-model"
import { createOcrSegmentedDocumentModel } from "@/registry/new-york-v4/ui/layout-blocks-segmented-document-model"
import {
  textractToLayoutDocument,
  type TextractDocument,
} from "@/registry/new-york-v4/ui/layout-blocks-textract"
import type {
  LayoutDocument,
  LayoutLevel,
} from "@/registry/new-york-v4/ui/layout-blocks-types"

const textractFixture = textractOutput as TextractDocument
const azureFixture = azureOutput as AzureDocument

describe("AWS Textract layout blocks", () => {
  it("normalizes pages, lines, and words from Textract blocks", () => {
    const document = textractToLayoutDocument(textractFixture)

    expect(document.pages).toHaveLength(1)
    expect(document.pages[0]).toMatchObject({ pageNumber: 1, rotation: 0 })
    expect(document.items.filter((i) => i.level === "line")).toHaveLength(9)
    expect(document.items.filter((i) => i.level === "word")).toHaveLength(27)
    expect(document.items.some((i) => i.level === "block")).toBe(false)
  })

  it("converts Textract 0–100 confidence onto a 0–1 scale", () => {
    const document = textractToLayoutDocument(textractFixture)
    const word = document.items.find((i) => i.level === "word")!

    expect(word.confidence).toBeGreaterThan(0)
    expect(word.confidence).toBeLessThanOrEqual(1)
    expect(
      document.items.every(
        (i) => i.confidence == null || (i.confidence >= 0 && i.confidence <= 1)
      )
    ).toBe(true)
  })

  it("rebuilds the WORD → LINE hierarchy from CHILD relationships", () => {
    const document = textractToLayoutDocument(textractFixture)
    const index = createLayoutItemIndex(document)
    const word = document.items.find((i) => i.level === "word")!
    const parent = word.parentId
      ? index.itemsById.get(word.parentId)
      : undefined

    expect(parent?.level).toBe("line")
    expect(parent?.text).toContain(word.text)
  })

  it("projects normalized geometry inside the synthetic page bounds", () => {
    const document = textractToLayoutDocument(textractFixture)
    const page = document.pages[0]!

    for (const item of document.items) {
      expect(item.rect).toBeDefined()
      expect(item.rect!.left).toBeGreaterThanOrEqual(0)
      expect(item.rect!.top).toBeGreaterThanOrEqual(0)
      expect(item.rect!.left + item.rect!.width).toBeLessThanOrEqual(
        page.width + 0.001
      )
      expect(item.rect!.top + item.rect!.height).toBeLessThanOrEqual(
        page.height + 0.001
      )
    }
  })

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
    }
    const document = textractToLayoutDocument(withLayout)
    const block = document.items.find((i) => i.level === "block")

    expect(block?.kind).toBe("title")
    expect(block?.text).toBe("Quarterly Report")
  })
})

describe("Azure Document Intelligence layout blocks", () => {
  it("normalizes paragraphs, lines, and words from analyzeResult", () => {
    const document = azureToLayoutDocument(azureFixture)

    expect(document.pages).toHaveLength(1)
    expect(document.items.filter((i) => i.level === "block")).toHaveLength(9)
    expect(document.items.filter((i) => i.level === "line")).toHaveLength(9)
    expect(document.items.filter((i) => i.level === "word")).toHaveLength(27)
  })

  it("scales inch page units and geometry into a pixel coordinate space", () => {
    const document = azureToLayoutDocument(azureFixture)
    const page = document.pages[0]!

    // 8.5in × 11in at 96 dpi.
    expect(page.width).toBeCloseTo(816, 5)
    expect(page.height).toBeCloseTo(1056, 5)
  })

  it("carries the full content buffer and maps paragraph roles to kinds", () => {
    const document = azureToLayoutDocument(azureFixture)
    const title = document.items.find((i) => i.level === "block")

    expect(document.text.startsWith("ACME CORPORATION")).toBe(true)
    expect(title?.kind).toBe("title")
    expect(title?.text).toBe("ACME CORPORATION")
  })

  it("derives word → line → block hierarchy from spans", () => {
    const document = azureToLayoutDocument(azureFixture)
    const index = createLayoutItemIndex(document)
    const word = document.items.find((i) => i.level === "word")!
    const line = word.parentId ? index.itemsById.get(word.parentId) : undefined
    const block = line?.parentId
      ? index.itemsById.get(line.parentId)
      : undefined

    expect(line?.level).toBe("line")
    expect(block?.level).toBe("block")
  })

  it("accepts a bare analyzeResult without the operation envelope", () => {
    const bare = (azureFixture as { analyzeResult: unknown })
      .analyzeResult as AzureDocument
    const document = azureToLayoutDocument(bare)

    expect(document.items.filter((i) => i.level === "word")).toHaveLength(27)
  })
})

// Mirrors the adaptive level selection in the viewer: inspect the coarsest
// level a provider actually produces so every source has rows to review.
const LEVEL_ORDER: LayoutLevel[] = ["block", "paragraph", "line", "word"]
function inspectedLevel(document: LayoutDocument): LayoutLevel {
  for (const level of LEVEL_ORDER) {
    if (document.items.some((item) => item.level === level)) return level
  }
  return "block"
}

describe("OCR viewer pipeline across providers", () => {
  const cases: { name: string; document: LayoutDocument; level: LayoutLevel }[] =
    [
      {
        name: "Google Document AI",
        document: documentAiToLayoutDocument(
          documentAiOutput as DocumentAiDocument
        ),
        level: "block",
      },
      {
        name: "AWS Textract",
        document: textractToLayoutDocument(textractFixture),
        level: "line",
      },
      {
        name: "Azure Document Intelligence",
        document: azureToLayoutDocument(azureFixture),
        level: "block",
      },
    ]

  it.each(cases)(
    "builds a non-empty viewer + segmented model for $name",
    ({ document, level }) => {
      expect(inspectedLevel(document)).toBe(level)

      const model = createLayoutBlocksViewerModel({
        document,
        levels: [level],
        threshold: 0.9,
      })
      expect(model.visibleItems.length).toBeGreaterThan(0)
      expect(model.evidenceItems.length).toBe(model.visibleItems.length)
      // Every visible item resolves to a page anchor (geometry is valid).
      expect(
        model.evidenceItems.every((item) => item.anchor.status === "resolved")
      ).toBe(true)

      const segmented = createOcrSegmentedDocumentModel({
        document,
        items: model.visibleItems,
      })
      expect(segmented.segments.length).toBe(model.visibleItems.length)
      expect(segmented.pages.length).toBe(document.pages.length)
    }
  )
})
