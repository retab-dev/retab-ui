// @vitest-environment jsdom

import * as React from "react"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { inferCsvDialect } from "@/lib/csv"
import { CsvViewer } from "@/components/ui/csv-viewer"
import { defaultCsvDownloadName } from "@/registry/new-york-v4/ui/csv-viewer-download"
import { resolveCsvResource } from "@/registry/new-york-v4/ui/csv-viewer-resource"

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

describe("CsvViewer", () => {
  it("renders TSV data with an explicit tab delimiter", () => {
    render(
      <CsvViewer
        value={"a\tb\n1\t2"}
        dialect={{ delimiter: "\t", hasHeader: true }}
        toolbar={false}
      />
    )

    expect(screen.getByText("a")).toBeTruthy()
    expect(screen.getByText("b")).toBeTruthy()
    expect(screen.getByText("2")).toBeTruthy()
  })

  it("keeps active cells tied to source rows after sorting", () => {
    const { container } = render(
      <CsvViewer
        data={{
          columns: ["id", "name"],
          rows: [
            ["2", "b"],
            ["1", "a"],
          ],
        }}
        activeCell={{ rowIndex: 0, columnIndex: 1 }}
        toolbar={false}
      />
    )

    expect(screen.getByTitle("b").className).toContain("ring-primary")

    fireEvent.click(screen.getByTitle("Sort by id"))

    expect(screen.getByTitle("b").className).toContain("ring-primary")

    const rows = Array.from(container.querySelectorAll('[data-slot="csv-row"]'))
    expect(
      rows[0]?.querySelector('[data-slot="csv-row-number"]')?.textContent
    ).toBe("2")
    expect(rows[0]?.textContent).toContain("1a")
    expect(
      rows[1]?.querySelector('[data-slot="csv-row-number"]')?.textContent
    ).toBe("1")
    expect(rows[1]?.textContent).toContain("2b")
  })
})

describe("FileViewer CSV integration", () => {
  it("selects tab delimiters for TSV descriptors", () => {
    expect(inferCsvDialect({ fileName: "data.tsv" }).delimiter).toBe("\t")
    expect(
      inferCsvDialect({
        fileName: "data",
        mimeType: "text/tab-separated-values",
      }).delimiter
    ).toBe("\t")
    expect(
      inferCsvDialect({
        fileName: "data.csv",
        mimeType: "text/tab-separated-values",
      }).delimiter
    ).toBe(",")
  })
})

describe("CsvViewer src loading", () => {
  it("infers tab delimiters for .tsv URLs", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response("a\tb\n1\t2", { status: 200 })))
    )

    render(<CsvViewer src="/data.tsv" toolbar={false} />)

    expect(await screen.findByText("b")).toBeTruthy()
    expect(screen.queryByText("a\tb")).toBeNull()
  })
})

describe("CsvViewer resource precedence", () => {
  it("resolves src, source, value, data, then empty", () => {
    const source = new Blob(["source"])
    const data = { columns: ["a"], rows: [["data"]] }

    expect(
      resolveCsvResource({ src: "/file.csv", source, value: "value", data })
        .kind
    ).toBe("src")
    expect(resolveCsvResource({ source, value: "value", data }).kind).toBe(
      "source"
    )
    expect(resolveCsvResource({ value: "value", data }).kind).toBe("value")
    expect(resolveCsvResource({ data }).kind).toBe("data")
    expect(resolveCsvResource({}).kind).toBe("empty")
  })
})

describe("CsvViewer download names", () => {
  it("uses dialect-only generated names when no downloadName is provided", () => {
    expect(defaultCsvDownloadName({ delimiter: ",", hasHeader: true })).toBe(
      "data.csv"
    )
    expect(defaultCsvDownloadName({ delimiter: "\t", hasHeader: true })).toBe(
      "data.tsv"
    )
  })
})
