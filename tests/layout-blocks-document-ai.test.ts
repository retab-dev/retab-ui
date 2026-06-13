import documentAiOutput from "@/sample/documentai-output.json"
import { describe, expect, it } from "vitest"

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
