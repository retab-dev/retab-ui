// @vitest-environment jsdom

import { describe, expect, it } from "vitest"

import { getVisiblePageFromViewport } from "@/components/viewers/page-markdown/visible-page"

function rect(top: number, height: number): DOMRect {
  return {
    top,
    bottom: top + height,
    left: 0,
    right: 100,
    width: 100,
    height,
    x: 0,
    y: top,
    toJSON: () => ({}),
  } as DOMRect
}

describe("getVisiblePageFromViewport", () => {
  it("returns the last page above the viewport marker", () => {
    const viewport = document.createElement("div")
    viewport.getBoundingClientRect = () => rect(100, 500)

    const firstPage = document.createElement("section")
    firstPage.dataset.pageNumber = "1"
    firstPage.getBoundingClientRect = () => rect(80, 300)

    const secondPage = document.createElement("section")
    secondPage.dataset.pageNumber = "2"
    secondPage.getBoundingClientRect = () => rect(180, 300)

    const thirdPage = document.createElement("section")
    thirdPage.dataset.pageNumber = "3"
    thirdPage.getBoundingClientRect = () => rect(240, 300)

    viewport.append(firstPage, secondPage, thirdPage)

    expect(getVisiblePageFromViewport(viewport)).toBe(2)
  })

  it("ignores malformed page numbers", () => {
    const viewport = document.createElement("div")
    viewport.getBoundingClientRect = () => rect(0, 500)

    const malformedPage = document.createElement("section")
    malformedPage.dataset.pageNumber = "wat"
    malformedPage.getBoundingClientRect = () => rect(0, 100)
    viewport.append(malformedPage)

    expect(getVisiblePageFromViewport(viewport)).toBe(1)
  })
})
