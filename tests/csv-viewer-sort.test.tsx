// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { CsvViewer } from "@/components/ui/csv-viewer"

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", ResizeObserverMock)
  Object.defineProperty(HTMLElement.prototype, "scrollTo", {
    configurable: true,
    value: vi.fn(),
  })
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

/** First-column cell text for every rendered row, in display order. */
function displayedFirstColumn(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll('[data-slot="csv-row"]')).map(
    (row) =>
      row
        .querySelector('[data-slot="csv-cell"] span')
        ?.textContent?.trim() ?? ""
  )
}

function renderTable(rows: string[][]) {
  return render(
    <CsvViewer
      source={{ kind: "table", table: { columns: ["v", "label"], rows } }}
      controls={false}
    />
  )
}

describe("CsvViewer sorting determinism", () => {
  it("orders a mixed numeric/text column with numbers first, ascending", () => {
    const { container } = renderTable([
      ["9", "a"],
      ["abc", "b"],
      ["10", "c"],
      ["5a", "d"],
      ["-2", "e"],
      ["100", "f"],
    ])

    fireEvent.click(screen.getByTitle("Sort by v"))

    expect(displayedFirstColumn(container)).toEqual([
      "-2",
      "9",
      "10",
      "100",
      "5a",
      "abc",
    ])
  })

  it("produces the same display order no matter the source row order", () => {
    const dataset = [
      ["9", "a"],
      ["abc", "b"],
      ["10", "c"],
      ["5a", "d"],
      ["-2", "e"],
      ["100", "f"],
    ]
    const shuffled = [
      ["100", "f"],
      ["-2", "e"],
      ["abc", "b"],
      ["5a", "d"],
      ["10", "c"],
      ["9", "a"],
    ]

    const first = renderTable(dataset)
    fireEvent.click(within(first.container).getByTitle("Sort by v"))
    const firstOrder = displayedFirstColumn(first.container)

    cleanup()

    const second = renderTable(shuffled)
    fireEvent.click(within(second.container).getByTitle("Sort by v"))
    const secondOrder = displayedFirstColumn(second.container)

    expect(secondOrder).toEqual(firstOrder)
  })

  it("cycles ascending -> descending -> unsorted", () => {
    const { container } = renderTable([
      ["3", "a"],
      ["1", "b"],
      ["2", "c"],
    ])
    const button = screen.getByTitle("Sort by v")
    const header = button.closest('[role="columnheader"]')

    fireEvent.click(button)
    expect(header?.getAttribute("aria-sort")).toBe("ascending")
    expect(displayedFirstColumn(container)).toEqual(["1", "2", "3"])

    fireEvent.click(button)
    expect(header?.getAttribute("aria-sort")).toBe("descending")
    expect(displayedFirstColumn(container)).toEqual(["3", "2", "1"])

    fireEvent.click(button)
    expect(header?.getAttribute("aria-sort")).toBe("none")
    // Back to source order.
    expect(displayedFirstColumn(container)).toEqual(["3", "1", "2"])
  })
})
