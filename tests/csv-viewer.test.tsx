// @vitest-environment jsdom

import * as React from "react"
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { inferCsvDialect } from "@/lib/csv"
import { CsvViewer } from "@/components/ui/csv-viewer"
import {
  blobSource,
  clearViewerResourceRegistryForTests,
  createViewerResource,
} from "@/registry/new-york-v4/lib/viewer-resource"
import { defaultCsvDownloadName } from "@/registry/new-york-v4/ui/csv-viewer-download"
import { resolveCsvResource } from "@/registry/new-york-v4/ui/csv-viewer-resource"

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

function mockObjectUrls(url = "blob:csv-download") {
  const createObjectURL = vi.fn<(input: Blob | MediaSource) => string>(
    () => url
  )
  const revokeObjectURL = vi.fn()
  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    value: createObjectURL,
  })
  Object.defineProperty(URL, "revokeObjectURL", {
    configurable: true,
    value: revokeObjectURL,
  })
  return { createObjectURL, revokeObjectURL }
}

function captureAnchorClicks() {
  const clicks: Array<{ href: string | null; download: string }> = []
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
    this: HTMLAnchorElement
  ) {
    clicks.push({
      href: this.getAttribute("href"),
      download: this.download,
    })
  })
  return clicks
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
  clearViewerResourceRegistryForTests()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe("CsvViewer", () => {
  it("renders TSV data with an explicit tab delimiter", () => {
    render(
      <CsvViewer
        source={{
          kind: "text",
          text: "a\tb\n1\t2",
          fileName: "data.tsv",
        }}
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
        source={{
          kind: "table",
          table: {
            columns: ["id", "name"],
            rows: [
              ["2", "b"],
              ["1", "a"],
            ],
          },
          fileName: "data.csv",
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

describe("CsvViewer URL source loading", () => {
  it("infers tab delimiters for .tsv URLs", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response("a\tb\n1\t2", { status: 200 })))
    )

    render(
      <CsvViewer
        source={{ kind: "url", url: "/data.tsv", fileName: "data.tsv" }}
        toolbar={false}
      />
    )

    expect(await screen.findByText("b")).toBeTruthy()
    expect(screen.queryByText("a\tb")).toBeNull()
  })
})

describe("CsvViewer Blob source loading", () => {
  it("parses Blob resources through the source boundary", async () => {
    render(
      <CsvViewer
        source={blobSource(new Blob(["a,b\n1,2"], { type: "text/csv" }), {
          identityKey: "csv:blob-test",
          fileName: "blob.csv",
          mimeType: "text/csv",
        })}
        toolbar={false}
      />
    )

    expect(await screen.findByText("b")).toBeTruthy()
    expect(screen.getByText("2")).toBeTruthy()
  })
})

describe("CsvViewer resource precedence", () => {
  it("resolves document sources, table sources, then empty", () => {
    const resource = createViewerResource(
      blobSource(new Blob(["source"]), {
        identityKey: "csv:test",
        fileName: "file.csv",
        mimeType: "text/csv",
      })
    )
    const table = { columns: ["a"], rows: [["data"]] }

    expect(resolveCsvResource({ resource }).kind).toBe("resource")
    expect(
      resolveCsvResource({
        source: { kind: "table", table, fileName: "data.csv" },
      })
    ).toEqual({
      kind: "table",
      table,
      fileName: "data.csv",
    })
    expect(resolveCsvResource({}).kind).toBe("empty")
  })

  it("treats text resources as synchronous values", () => {
    const resource = createViewerResource({
      kind: "text",
      text: "a,b\n1,2",
      fileName: "inline.csv",
    })

    expect(resolveCsvResource({ resource })).toEqual({
      kind: "text",
      text: "a,b\n1,2",
    })
  })
})

describe("CsvViewer download names", () => {
  it("uses dialect-only generated names for parsed data downloads", () => {
    expect(defaultCsvDownloadName({ delimiter: ",", hasHeader: true })).toBe(
      "data.csv"
    )
    expect(defaultCsvDownloadName({ delimiter: "\t", hasHeader: true })).toBe(
      "data.tsv"
    )
  })

  it("exports parsed table sources through the shared derived action", async () => {
    const { createObjectURL, revokeObjectURL } = mockObjectUrls()
    const clicks = captureAnchorClicks()

    render(
      <CsvViewer
        source={{
          kind: "table",
          table: {
            columns: ["a", "b"],
            rows: [["1", "2"]],
          },
          fileName: "table.csv",
        }}
      />
    )

    expect(screen.getByRole("button", { name: "Export table" })).toBeTruthy()
    expect(createObjectURL).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole("button", { name: "Export table" }))

    await waitFor(() => expect(createObjectURL).toHaveBeenCalledTimes(1))
    const blob = createObjectURL.mock.calls[0]?.[0] as unknown as Blob
    expect(await blob.text()).toBe("a,b\r\n1,2")
    expect(clicks).toEqual([
      { href: "blob:csv-download", download: "table.csv" },
    ])
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:csv-download")
  })

  it("offers original and derived actions for document sources", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response("a,b\n1,2", { status: 200 })))
    )

    render(
      <CsvViewer
        source={{ kind: "url", url: "/report.csv", fileName: "report.csv" }}
      />
    )

    expect(await screen.findByText("b")).toBeTruthy()

    fireEvent.click(screen.getByRole("button", { name: "Download" }))

    expect(await screen.findByText("Download original")).toBeTruthy()
    expect(await screen.findByText("Export table")).toBeTruthy()
  })
})
