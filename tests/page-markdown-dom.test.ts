// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest"

import { scrollPageIntoView } from "@/components/viewers/page-markdown/page-markdown-dom"

describe("scrollPageIntoView", () => {
  it("scrolls the requested page into view", () => {
    const root = document.createElement("div")
    const firstPage = document.createElement("section")
    const secondPage = document.createElement("section")
    const scrollIntoView = vi.fn()

    firstPage.dataset.pageNumber = "1"
    secondPage.dataset.pageNumber = "2"
    secondPage.scrollIntoView = scrollIntoView
    root.append(firstPage, secondPage)

    scrollPageIntoView(root, 2)

    expect(scrollIntoView).toHaveBeenCalledWith({
      behavior: "smooth",
      block: "start",
    })
  })

  it("does nothing without a matching root or page", () => {
    expect(() => scrollPageIntoView(null, 3)).not.toThrow()
    expect(() =>
      scrollPageIntoView(document.createElement("div"), 3)
    ).not.toThrow()
  })
})
