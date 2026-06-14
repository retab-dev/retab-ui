import documentAiOutput from "@/sample/documentai-output.json"
import { describe, expect, it } from "vitest"

import { layoutItemsToSegmentedDocumentModel } from "@/components/ui/layout-blocks-segmented-document-model"
import {
  documentAiToLayoutDocument,
  type DocumentAiDocument,
} from "@/registry/new-york-v4/ui/layout-blocks-document-ai"
import {
  getRotatedPageSize,
  normalizeLayoutRect,
  rotatePoint,
  toSvgPoints,
} from "@/registry/new-york-v4/ui/layout-blocks-geometry"
import { createLayoutItemIndex } from "@/registry/new-york-v4/ui/layout-blocks-index"
import {
  createLayoutBlocksViewerModel,
  createLayoutItemIndex as createLayoutEvidenceIndex,
  filterLayoutItems,
  layoutItemsToEvidenceModel,
  layoutItemToEvidenceItem,
} from "@/registry/new-york-v4/ui/layout-blocks-model"
import type {
  LayoutDocument,
  LayoutItem,
} from "@/registry/new-york-v4/ui/layout-blocks-types"

const documentAiFixture = documentAiOutput as DocumentAiDocument

describe("Document AI layout blocks", () => {
  it("normalizes the sample into pages and inspectable layout items", () => {
    const document = documentAiToLayoutDocument(documentAiFixture)
    const page = document.pages[0]

    expect(page).toMatchObject({
      pageNumber: 1,
      width: 1681,
      height: 2378,
      rotation: 0,
    })
    expect(document.text).toHaveLength(41406)
    expect(
      document.items.filter((item) => item.level === "block")
    ).toHaveLength(625)
    expect(
      document.items.filter((item) => item.level === "paragraph")
    ).toHaveLength(667)
    expect(document.items.filter((item) => item.level === "line")).toHaveLength(
      1030
    )
    expect(document.items.filter((item) => item.level === "word")).toHaveLength(
      9612
    )
    expect(
      document.items.filter((item) => item.level !== "paragraph")
    ).toHaveLength(625 + 1030 + 9612)
  })

  it("slices text anchors from the global text buffer", () => {
    const document = documentAiToLayoutDocument(documentAiFixture)
    const firstBlock = document.items.find((item) => item.level === "block")
    const firstWord = document.items.find((item) => item.level === "word")

    expect(firstBlock?.text).toBe("arXiv:1412.6980v9 [cs.LG] 30 Jan 2017\n")
    expect(firstBlock?.span).toEqual({ start: 0, end: 38 })
    expect(firstWord?.text).toBe("arXiv")
    expect(firstWord?.span).toEqual({ start: 0, end: 5 })
  })

  it("derives hierarchy from text-span containment", () => {
    const document = documentAiToLayoutDocument(documentAiFixture)
    const index = createLayoutItemIndex({
      items: document.items,
      pages: document.pages,
    })
    const firstWord = document.items.find((item) => item.level === "word")
    const firstLine = document.items.find((item) => item.level === "line")
    const firstParagraph = document.items.find(
      (item) => item.level === "paragraph"
    )

    expect(firstWord?.parentId).toBe(firstLine?.id)
    expect(firstLine?.parentId).toBe(firstParagraph?.id)
    const parentLine = firstWord?.parentId
      ? index.itemsById.get(firstWord.parentId)
      : undefined
    expect(parentLine?.span).toEqual({ start: 0, end: 38 })
  })

  it("surfaces low-confidence tokens from the Adam OCR fixture", () => {
    const document = documentAiToLayoutDocument(documentAiFixture)
    const lowConfidenceTokens = document.items
      .filter((item) => item.level === "word")
      .filter((item) => item.confidence != null && item.confidence < 0.9)
      .map((item) => item.text)

    expect(lowConfidenceTokens).toHaveLength(1872)
    expect(lowConfidenceTokens.slice(0, 8)).toEqual([
      "*\n",
      "; ",
      "; ",
      "; ",
      "gł ",
      "gt",
      "a ",
      "β₁ ",
    ])
  })

  it("keeps geometry finite and rotation-correct", () => {
    const document = documentAiToLayoutDocument(documentAiFixture)
    const page = document.pages[0]!
    const firstWord = document.items.find((item) => item.level === "word")!
    const quad = firstWord.quad!

    expect(toSvgPoints(quad, page).split(" ")).toEqual([
      expect.stringMatching(/^2\.9149315883402735/),
      expect.stringMatching(/^2\.9149315883402735/),
      expect.stringMatching(/^6\.186793575252826/),
      expect.stringMatching(/^6\.186793575252826/),
    ])
    expect(rotatePoint({ x: 227, y: 73 }, page, 90)).toEqual({
      x: 2305,
      y: 227,
    })
    expect(getRotatedPageSize(page, 90)).toEqual({
      width: 2378,
      height: 1681,
    })
    expect(
      normalizeLayoutRect(
        { left: Number.NaN, top: 0, width: 10, height: 10 },
        page
      )
    ).toBeNull()
  })
})

describe("layout blocks evidence projection", () => {
  const layoutItems: LayoutItem[] = [
    {
      id: "block-1",
      pageNumber: 1,
      level: "block",
      kind: "paragraph",
      text: "High confidence block",
      confidence: 0.98,
      rect: { left: 100, top: 200, width: 300, height: 400 },
    },
    {
      id: "block-2",
      pageNumber: 1,
      level: "block",
      kind: "paragraph",
      text: "Low confidence block",
      confidence: 0.61,
      rect: { left: 10, top: 20, width: 30, height: 40 },
    },
    {
      id: "line-1",
      pageNumber: 1,
      level: "line",
      kind: "paragraph",
      text: "Line item",
      confidence: 0.8,
      rect: { left: 50, top: 60, width: 70, height: 80 },
    },
    {
      id: "missing-page",
      pageNumber: 99,
      level: "block",
      kind: "paragraph",
      text: "Missing page",
      confidence: 0.5,
      rect: { left: 1, top: 1, width: 1, height: 1 },
    },
  ]
  const layoutDocument: LayoutDocument = {
    text: "",
    pages: [{ pageNumber: 1, width: 1000, height: 2000, rotation: 0 }],
    items: layoutItems,
  }

  it("projects visible OCR items to evidence rows and provider items", () => {
    const model = createLayoutBlocksViewerModel({
      document: layoutDocument,
      levels: ["block"],
      threshold: 0.9,
    })

    expect(model.visibleItems.map((item) => item.id)).toEqual([
      "block-1",
      "block-2",
      "missing-page",
    ])
    expect(model.evidenceItems).toMatchObject([
      {
        id: "block-1",
        payload: {
          item: layoutItems[0],
          level: "block",
          kind: "paragraph",
          text: "High confidence block",
          confidence: 0.98,
          pageNumber: 1,
        },
        anchor: {
          status: "resolved",
          anchor: {
            kind: "pdf-area",
            pageNumber: 1,
            left: 10,
            top: 10,
            width: 30,
            height: 20,
          },
        },
      },
      {
        id: "block-2",
        payload: {
          item: layoutItems[1],
          level: "block",
          kind: "paragraph",
          text: "Low confidence block",
          confidence: 0.61,
          pageNumber: 1,
        },
        anchor: { status: "resolved" },
      },
      {
        id: "missing-page",
        payload: {
          item: layoutItems[3],
          level: "block",
          kind: "paragraph",
          text: "Missing page",
          confidence: 0.5,
          pageNumber: 99,
        },
        anchor: { status: "missing" },
      },
    ])
    expect(model.anchoredItems).toEqual([
      {
        id: "block-1",
        anchor: {
          kind: "pdf-area",
          pageNumber: 1,
          left: 10,
          top: 10,
          width: 30,
          height: 20,
        },
        disabled: false,
      },
      {
        id: "block-2",
        anchor: {
          kind: "pdf-area",
          pageNumber: 1,
          left: 1,
          top: 1,
          width: 3,
          height: 2,
        },
        disabled: false,
      },
      { id: "missing-page", anchor: null, disabled: false },
    ])
  })

  it("projects visible OCR items to segmented document segments and anchors", () => {
    const visibleItems = filterLayoutItems(layoutDocument.items, {
      levels: ["block"],
      threshold: 0.9,
    })
    const model = layoutItemsToSegmentedDocumentModel({
      document: layoutDocument,
      items: visibleItems,
    })

    expect(model.pages).toEqual([{ pageNumber: 1, width: 1000, height: 2000 }])
    expect(model.segments).toMatchObject([
      {
        id: "layout:block-1",
        label: "High confidence block",
        pages: [1],
        confidence: 0.98,
        sourceId: "block-1",
      },
      {
        id: "layout:block-2",
        label: "Low confidence block",
        pages: [1],
        confidence: 0.61,
        sourceId: "block-2",
      },
      {
        id: "layout:missing-page",
        label: "Missing page",
        pages: [],
        confidence: 0.5,
        sourceId: "missing-page",
      },
    ])
    expect(model.anchors).toEqual([
      {
        id: "layout:block-1:anchor",
        segmentId: "layout:block-1",
        pageNumber: 1,
        bounds: { x: 0.1, y: 0.1, width: 0.3, height: 0.2 },
      },
      {
        id: "layout:block-2:anchor",
        segmentId: "layout:block-2",
        pageNumber: 1,
        bounds: { x: 0.01, y: 0.01, width: 0.03, height: 0.02 },
      },
    ])
  })

  it("filters low-confidence OCR items without changing item ids", () => {
    const model = createLayoutBlocksViewerModel({
      document: layoutDocument,
      levels: ["block", "line"],
      lowConfidenceOnly: true,
      threshold: 0.9,
    })

    expect(model.visibleItems.map((item) => item.id)).toEqual([
      "block-2",
      "line-1",
      "missing-page",
    ])
    expect(model.evidenceItems.map((item) => item.id)).toEqual([
      "block-2",
      "line-1",
      "missing-page",
    ])
    expect(model.anchoredItems.map((item) => item.id)).toEqual([
      "block-2",
      "line-1",
      "missing-page",
    ])
  })

  it("keeps OCR filtering separate from evidence projection", () => {
    const index = createLayoutEvidenceIndex(layoutDocument)
    const visibleItems = filterLayoutItems(layoutDocument.items, {
      levels: ["block", "line"],
      lowConfidenceOnly: true,
      threshold: 0.9,
    })
    const model = layoutItemsToEvidenceModel(visibleItems, index)

    expect(visibleItems.map((item) => item.id)).toEqual([
      "block-2",
      "line-1",
      "missing-page",
    ])
    expect(model.evidenceItems.map((item) => item.id)).toEqual([
      "block-2",
      "line-1",
      "missing-page",
    ])
  })

  it("projects a single layout item with its original domain item in typed payload", () => {
    const index = createLayoutEvidenceIndex(layoutDocument)
    const evidence = layoutItemToEvidenceItem(layoutItems[0]!, index)

    expect(evidence.payload.item).toBe(layoutItems[0])
    expect(evidence.payload.kind).toBe("paragraph")
    expect(evidence.payload.level).toBe("block")
    expect(evidence.anchor.status).toBe("resolved")
  })
})
