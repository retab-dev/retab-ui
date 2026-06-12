// @vitest-environment jsdom

import * as React from "react"
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  blobSource,
  clearViewerResourceRegistryForTests,
} from "@/registry/new-york-v4/lib/viewer-resource"
import { createCompactSheet } from "@/registry/new-york-v4/lib/xlsx-workbook"
import {
  XlsxViewer,
  type XlsxViewerHandle,
} from "@/registry/new-york-v4/ui/xlsx-viewer"

vi.mock("@/components/ui/xlsx-grid", async () => {
  const React = await import("react")
  return {
    XlsxGrid: ({
      sheetName,
      scrollRequest,
    }: {
      sheetName: string
      scrollRequest?: {
        sheetIndex: number
        rowIndex: number
        columnIndex: number
        behavior: ScrollBehavior
      } | null
    }) =>
      React.createElement(
        "div",
        {
          role: "grid",
          "aria-label": sheetName,
          "data-scroll-target": scrollRequest
            ? `${scrollRequest.sheetIndex}:${scrollRequest.rowIndex}:${scrollRequest.columnIndex}:${scrollRequest.behavior}`
            : "",
        },
        sheetName
      ),
    XlsxGridSkeleton: () =>
      React.createElement("div", { role: "status" }, "Loading grid"),
  }
})

const originalFetch = globalThis.fetch
const originalWorker = globalThis.Worker

class FakeXlsxWorker {
  static instances: FakeXlsxWorker[] = []

  onmessage: ((event: MessageEvent) => void) | null = null
  onerror: ((event: ErrorEvent) => void) | null = null
  postMessage = vi.fn()
  terminate = vi.fn()

  constructor() {
    FakeXlsxWorker.instances.push(this)
  }
}

function mockObjectUrls(url = "blob:xlsx-export") {
  const createObjectURL = vi.fn((_blob: Blob) => url)
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
  clearViewerResourceRegistryForTests()
  FakeXlsxWorker.instances = []
  globalThis.fetch = vi.fn(async () => ({
    ok: true,
    arrayBuffer: async () => new ArrayBuffer(8),
  })) as unknown as typeof fetch
  globalThis.Worker = FakeXlsxWorker as unknown as typeof Worker
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  globalThis.fetch = originalFetch
  globalThis.Worker = originalWorker
})

function uniqueXlsxUrl(label: string) {
  return `/test-${label}-${crypto.randomUUID()}.xlsx`
}

async function waitForWorker(index = 0) {
  await waitFor(() => {
    expect(FakeXlsxWorker.instances.length).toBeGreaterThan(index)
    expect(FakeXlsxWorker.instances[index].onmessage).not.toBeNull()
  })
  return FakeXlsxWorker.instances[index]
}

async function emitWorkbook(
  worker: FakeXlsxWorker,
  sheets: Parameters<typeof createCompactSheet>[0][]
) {
  await act(async () => {
    worker.onmessage?.({
      data: {
        type: "workbook",
        sheets: sheets.map(createCompactSheet),
      },
    } as MessageEvent)
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
}

describe("XlsxViewer imperative ref", () => {
  it("replays a pre-load scrollToCell call after workbook metadata is reported", async () => {
    const viewerRef = React.createRef<XlsxViewerHandle>()
    const onSheetChange = vi.fn()

    await act(async () => {
      render(
        <XlsxViewer
          ref={viewerRef}
          source={{
            kind: "url",
            url: `/mounted-preload-${crypto.randomUUID()}.xlsx`,
            fileName: "mounted-preload.xlsx",
          }}
          toolbar={false}
          onSheetChange={onSheetChange}
        />
      )
    })

    await waitFor(() => expect(viewerRef.current).not.toBeNull())

    await act(async () => {
      viewerRef.current?.scrollToCell(1, 2, 3, { behavior: "auto" })
    })

    await waitFor(() => {
      expect(FakeXlsxWorker.instances.length).toBe(1)
      expect(FakeXlsxWorker.instances[0].onmessage).not.toBeNull()
    })

    const sheets = [
      createCompactSheet({
        name: "Summary",
        rowCount: 3,
        columnCount: 2,
        entries: [{ cellIndex: 0, text: "summary" }],
      }),
      createCompactSheet({
        name: "Detail",
        rowCount: 4,
        columnCount: 5,
        entries: [{ cellIndex: 2 * 5 + 3, text: "target" }],
      }),
    ]

    await act(async () => {
      FakeXlsxWorker.instances[0].onmessage?.({
        data: { type: "workbook", sheets },
      } as MessageEvent)
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    const detailGrid = await screen.findByRole("grid", { name: "Detail" })
    await waitFor(() =>
      expect(detailGrid.getAttribute("data-scroll-target")).toBe("1:2:3:auto")
    )
    expect(onSheetChange).toHaveBeenCalledWith(1)
  })

  it("loads Blob sources without fetching a URL", async () => {
    await act(async () => {
      render(
        <XlsxViewer
          source={blobSource(new Uint8Array([1, 2, 3]), {
            identityKey: "blob:xlsx",
            fileName: "local.xlsx",
          })}
          toolbar={false}
        />
      )
    })

    await waitFor(() => {
      expect(FakeXlsxWorker.instances.length).toBe(1)
      expect(FakeXlsxWorker.instances[0].onmessage).not.toBeNull()
    })

    await act(async () => {
      FakeXlsxWorker.instances[0].onmessage?.({
        data: {
          type: "workbook",
          sheets: [
            createCompactSheet({
              name: "Local",
              rowCount: 1,
              columnCount: 1,
              entries: [{ cellIndex: 0, text: "blob" }],
            }),
          ],
        },
      } as MessageEvent)
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    expect(await screen.findByRole("grid", { name: "Local" })).toBeTruthy()
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })

  it("exports the active sheet as a derived CSV download", async () => {
    const { createObjectURL, revokeObjectURL } = mockObjectUrls()
    const clicks = captureAnchorClicks()

    await act(async () => {
      render(
        <XlsxViewer
          source={blobSource(new Uint8Array([1, 2, 3]), {
            identityKey: "blob:xlsx-export",
            fileName: "book.xlsx",
          })}
          defaultSheetIndex={1}
        />
      )
    })

    await waitFor(() => {
      expect(FakeXlsxWorker.instances.length).toBe(1)
      expect(FakeXlsxWorker.instances[0].onmessage).not.toBeNull()
    })

    await act(async () => {
      FakeXlsxWorker.instances[0].onmessage?.({
        data: {
          type: "workbook",
          sheets: [
            createCompactSheet({
              name: "Summary",
              rowCount: 1,
              columnCount: 1,
              entries: [{ cellIndex: 0, text: "ignored" }],
            }),
            createCompactSheet({
              name: "Detail",
              rowCount: 2,
              columnCount: 2,
              entries: [
                { cellIndex: 0, text: "name" },
                { cellIndex: 3, text: "42", numeric: true },
              ],
            }),
          ],
        },
      } as MessageEvent)
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    expect(await screen.findByRole("grid", { name: "Detail" })).toBeTruthy()
    expect(createObjectURL).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole("button", { name: "Download" }))
    fireEvent.click(await screen.findByText("Export sheet"))

    await waitFor(() => expect(createObjectURL).toHaveBeenCalledTimes(1))
    const blob = createObjectURL.mock.calls[0]?.[0] as unknown as Blob
    expect(await blob.text()).toBe("A,B\r\nname,\r\n,42")
    expect(clicks).toEqual([
      { href: "blob:xlsx-export", download: "book.Detail.csv" },
    ])
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:xlsx-export")
  })

  it("offers original and active-sheet export actions when ready", async () => {
    await act(async () => {
      render(
        <XlsxViewer
          source={{
            kind: "url",
            url: "/book.xlsx",
            fileName: "book.xlsx",
            downloadUrl: "/download/book.xlsx",
          }}
        />
      )
    })

    await waitFor(() => {
      expect(FakeXlsxWorker.instances.length).toBe(1)
      expect(FakeXlsxWorker.instances[0].onmessage).not.toBeNull()
    })

    await act(async () => {
      FakeXlsxWorker.instances[0].onmessage?.({
        data: {
          type: "workbook",
          sheets: [
            createCompactSheet({
              name: "Only",
              rowCount: 1,
              columnCount: 1,
              entries: [{ cellIndex: 0, text: "value" }],
            }),
          ],
        },
      } as MessageEvent)
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    expect(await screen.findByRole("grid", { name: "Only" })).toBeTruthy()

    fireEvent.click(screen.getByRole("button", { name: "Download" }))

    expect(await screen.findByText("Download original")).toBeTruthy()
    expect(await screen.findByText("Export sheet")).toBeTruthy()
  })

  it("sends workbook bytes to the worker with a transferable buffer", async () => {
    const bytes = new Uint8Array([9, 8, 7, 6])

    await act(async () => {
      render(
        <XlsxViewer
          source={blobSource(bytes, {
            identityKey: "blob:xlsx-transfer-request",
            fileName: "transfer-request.xlsx",
          })}
          toolbar={false}
        />
      )
    })

    const worker = await waitForWorker()
    expect(worker.postMessage).toHaveBeenCalledTimes(1)

    const [request, transfer] = worker.postMessage.mock.calls[0] ?? []
    expect(request).toMatchObject({ type: "parse_workbook" })
    expect(request.buffer).toBeInstanceOf(ArrayBuffer)
    expect(request.buffer.byteLength).toBe(bytes.byteLength)
    expect(transfer).toEqual([request.buffer])
  })

  it("reuses a resolved workbook source across remounts without starting another worker", async () => {
    const source = {
      kind: "url" as const,
      url: uniqueXlsxUrl("cache-remount"),
      fileName: "cache-remount.xlsx",
    }

    let first!: ReturnType<typeof render>
    await act(async () => {
      first = render(<XlsxViewer source={source} toolbar={false} />)
    })
    await emitWorkbook(await waitForWorker(), [
      {
        name: "Cached",
        rowCount: 1,
        columnCount: 1,
        entries: [{ cellIndex: 0, text: "cached" }],
      },
    ])

    expect(await screen.findByRole("grid", { name: "Cached" })).toBeTruthy()
    await act(async () => {
      first.unmount()
    })

    await act(async () => {
      render(<XlsxViewer source={source} toolbar={false} />)
      await Promise.resolve()
    })

    expect(await screen.findByRole("grid", { name: "Cached" })).toBeTruthy()
    expect(FakeXlsxWorker.instances).toHaveLength(1)
    expect(globalThis.fetch).toHaveBeenCalledTimes(1)
  })

  it("reuses the workbook source across metadata-only source changes", async () => {
    const url = uniqueXlsxUrl("metadata-cache")
    let rerender!: ReturnType<typeof render>["rerender"]

    await act(async () => {
      const rendered = render(
        <XlsxViewer
          source={{
            kind: "url",
            url,
            fileName: "first-name.xlsx",
          }}
          toolbar={false}
        />
      )
      rerender = rendered.rerender
    })

    await emitWorkbook(await waitForWorker(), [
      {
        name: "Metadata",
        rowCount: 1,
        columnCount: 1,
        entries: [{ cellIndex: 0, text: "same workbook" }],
      },
    ])

    expect(await screen.findByRole("grid", { name: "Metadata" })).toBeTruthy()

    await act(async () => {
      rerender(
        <XlsxViewer
          source={{
            kind: "url",
            url,
            fileName: "second-name.xlsx",
          }}
          toolbar={false}
        />
      )
      await Promise.resolve()
    })

    expect(await screen.findByRole("grid", { name: "Metadata" })).toBeTruthy()
    expect(FakeXlsxWorker.instances).toHaveLength(1)
    expect(globalThis.fetch).toHaveBeenCalledTimes(1)
  })

  it("renders an empty workbook as an empty synthetic first sheet", async () => {
    await act(async () => {
      render(
        <XlsxViewer
          source={{
            kind: "url",
            url: uniqueXlsxUrl("empty-workbook"),
            fileName: "empty-workbook.xlsx",
          }}
        />
      )
    })

    await emitWorkbook(await waitForWorker(), [])

    expect(await screen.findByRole("grid", { name: "Sheet 1" })).toBeTruthy()
    expect(screen.getByText("-")).toBeTruthy()
    expect(screen.queryByRole("tablist")).toBeNull()
  })

  it("does not render toolbar chrome while a toolbar-free workbook is pending on the client", async () => {
    await act(async () => {
      render(
        <XlsxViewer
          source={{
            kind: "url",
            url: uniqueXlsxUrl("pending-toolbarless"),
            fileName: "pending-toolbarless.xlsx",
          }}
          toolbar={false}
        />
      )
    })

    await waitForWorker()

    expect(screen.getByRole("status").textContent).toBe("Loading grid")
    expect(screen.queryByLabelText("Zoom in")).toBeNull()
    expect(screen.queryByLabelText("Download")).toBeNull()
  })

  it("changes sheets through tabs, updates the grid, and ignores same-tab clicks", async () => {
    const onSheetChange = vi.fn()

    await act(async () => {
      render(
        <XlsxViewer
          source={{
            kind: "url",
            url: uniqueXlsxUrl("tabs"),
            fileName: "tabs.xlsx",
          }}
          toolbar={false}
          onSheetChange={onSheetChange}
        />
      )
    })

    await emitWorkbook(await waitForWorker(), [
      {
        name: "Summary",
        rowCount: 1,
        columnCount: 1,
        entries: [{ cellIndex: 0, text: "summary" }],
      },
      {
        name: "Detail",
        rowCount: 2,
        columnCount: 2,
        entries: [{ cellIndex: 0, text: "detail" }],
      },
      {
        name: "Archive",
        rowCount: 3,
        columnCount: 3,
        entries: [{ cellIndex: 0, text: "archive" }],
      },
    ])

    expect(await screen.findByRole("grid", { name: "Summary" })).toBeTruthy()

    fireEvent.click(screen.getByRole("tab", { name: "Detail" }))
    expect(await screen.findByRole("grid", { name: "Detail" })).toBeTruthy()
    expect(onSheetChange).toHaveBeenCalledTimes(1)
    expect(onSheetChange).toHaveBeenLastCalledWith(1)
    expect(
      screen.getByRole("tab", { name: "Detail" }).getAttribute("aria-selected")
    ).toBe("true")

    fireEvent.click(screen.getByRole("tab", { name: "Detail" }))
    expect(onSheetChange).toHaveBeenCalledTimes(1)
  })

  it("clamps an out-of-range default sheet to the last available sheet", async () => {
    const onSheetChange = vi.fn()

    await act(async () => {
      render(
        <XlsxViewer
          source={{
            kind: "url",
            url: uniqueXlsxUrl("default-clamp"),
            fileName: "default-clamp.xlsx",
          }}
          defaultSheetIndex={99}
          toolbar={false}
          onSheetChange={onSheetChange}
        />
      )
    })

    await emitWorkbook(await waitForWorker(), [
      {
        name: "Summary",
        rowCount: 1,
        columnCount: 1,
        entries: [{ cellIndex: 0, text: "summary" }],
      },
      {
        name: "Last",
        rowCount: 1,
        columnCount: 1,
        entries: [{ cellIndex: 0, text: "last" }],
      },
    ])

    expect(await screen.findByRole("grid", { name: "Last" })).toBeTruthy()
    expect(
      screen.getByRole("tab", { name: "Last" }).getAttribute("aria-selected")
    ).toBe("true")
    expect(onSheetChange).not.toHaveBeenCalled()
  })

  it("falls back to the first sheet for invalid default sheet indexes", async () => {
    await act(async () => {
      render(
        <XlsxViewer
          source={{
            kind: "url",
            url: uniqueXlsxUrl("nan-default"),
            fileName: "nan-default.xlsx",
          }}
          defaultSheetIndex={Number.NaN}
          toolbar={false}
        />
      )
    })

    await emitWorkbook(await waitForWorker(), [
      {
        name: "First",
        rowCount: 1,
        columnCount: 1,
        entries: [{ cellIndex: 0, text: "first" }],
      },
      {
        name: "Second",
        rowCount: 1,
        columnCount: 1,
        entries: [{ cellIndex: 0, text: "second" }],
      },
    ])

    expect(await screen.findByRole("grid", { name: "First" })).toBeTruthy()
    expect(screen.queryByRole("grid", { name: /NaN/ })).toBeNull()

    cleanup()
    FakeXlsxWorker.instances = []

    await act(async () => {
      render(
        <XlsxViewer
          source={{
            kind: "url",
            url: uniqueXlsxUrl("fraction-default"),
            fileName: "fraction-default.xlsx",
          }}
          defaultSheetIndex={0.5}
          toolbar={false}
        />
      )
    })

    await emitWorkbook(await waitForWorker(), [
      {
        name: "Fraction First",
        rowCount: 1,
        columnCount: 1,
        entries: [{ cellIndex: 0, text: "first" }],
      },
      {
        name: "Fraction Second",
        rowCount: 1,
        columnCount: 1,
        entries: [{ cellIndex: 0, text: "second" }],
      },
    ])

    expect(
      await screen.findByRole("grid", { name: "Fraction First" })
    ).toBeTruthy()
    expect(screen.queryByRole("grid", { name: /0\.5/ })).toBeNull()

    cleanup()
    FakeXlsxWorker.instances = []

    await act(async () => {
      render(
        <XlsxViewer
          source={{
            kind: "url",
            url: uniqueXlsxUrl("unsafe-default"),
            fileName: "unsafe-default.xlsx",
          }}
          defaultSheetIndex={Number.MAX_SAFE_INTEGER + 1}
          toolbar={false}
        />
      )
    })

    await emitWorkbook(await waitForWorker(), [
      {
        name: "Unsafe First",
        rowCount: 1,
        columnCount: 1,
        entries: [{ cellIndex: 0, text: "first" }],
      },
      {
        name: "Unsafe Second",
        rowCount: 1,
        columnCount: 1,
        entries: [{ cellIndex: 0, text: "second" }],
      },
    ])

    expect(
      await screen.findByRole("grid", { name: "Unsafe First" })
    ).toBeTruthy()
  })

  it("keeps only the latest pre-load imperative scroll target", async () => {
    const viewerRef = React.createRef<XlsxViewerHandle>()
    const onSheetChange = vi.fn()

    await act(async () => {
      render(
        <XlsxViewer
          ref={viewerRef}
          source={{
            kind: "url",
            url: uniqueXlsxUrl("latest-scroll"),
            fileName: "latest-scroll.xlsx",
          }}
          toolbar={false}
          onSheetChange={onSheetChange}
        />
      )
    })

    await waitFor(() => expect(viewerRef.current).not.toBeNull())

    await act(async () => {
      viewerRef.current?.scrollToCell(0, 0, 0, { behavior: "auto" })
      viewerRef.current?.scrollToCell(1, 2, 3)
    })

    await emitWorkbook(await waitForWorker(), [
      {
        name: "Summary",
        rowCount: 1,
        columnCount: 1,
        entries: [{ cellIndex: 0, text: "summary" }],
      },
      {
        name: "Detail",
        rowCount: 4,
        columnCount: 5,
        entries: [{ cellIndex: 2 * 5 + 3, text: "target" }],
      },
    ])

    const detailGrid = await screen.findByRole("grid", { name: "Detail" })
    await waitFor(() =>
      expect(detailGrid.getAttribute("data-scroll-target")).toBe("1:2:3:smooth")
    )
    expect(onSheetChange).toHaveBeenCalledTimes(1)
    expect(onSheetChange).toHaveBeenLastCalledWith(1)
  })

  it("ignores invalid post-load imperative scroll targets", async () => {
    const viewerRef = React.createRef<XlsxViewerHandle>()
    const onSheetChange = vi.fn()

    await act(async () => {
      render(
        <XlsxViewer
          ref={viewerRef}
          source={{
            kind: "url",
            url: uniqueXlsxUrl("invalid-scroll"),
            fileName: "invalid-scroll.xlsx",
          }}
          toolbar={false}
          onSheetChange={onSheetChange}
        />
      )
    })

    await emitWorkbook(await waitForWorker(), [
      {
        name: "Summary",
        rowCount: 1,
        columnCount: 1,
        entries: [{ cellIndex: 0, text: "summary" }],
      },
      {
        name: "Detail",
        rowCount: 2,
        columnCount: 2,
        entries: [{ cellIndex: 0, text: "detail" }],
      },
    ])

    const summaryGrid = await screen.findByRole("grid", { name: "Summary" })

    await act(async () => {
      viewerRef.current?.scrollToCell(1, 9, 0)
      viewerRef.current?.scrollToCell(1, 0, -1)
      viewerRef.current?.scrollToCell(-1, 0, 0)
    })

    expect(await screen.findByRole("grid", { name: "Summary" })).toBe(
      summaryGrid
    )
    expect(summaryGrid.getAttribute("data-scroll-target")).toBe("")
    expect(onSheetChange).not.toHaveBeenCalled()
  })

  it("does not let a stale source load replace a newer source", async () => {
    let rerender!: ReturnType<typeof render>["rerender"]

    await act(async () => {
      const rendered = render(
        <XlsxViewer
          source={{
            kind: "url",
            url: uniqueXlsxUrl("stale-a"),
            fileName: "stale-a.xlsx",
          }}
          toolbar={false}
        />
      )
      rerender = rendered.rerender
    })

    const firstWorker = await waitForWorker(0)

    await act(async () => {
      rerender(
        <XlsxViewer
          source={{
            kind: "url",
            url: uniqueXlsxUrl("stale-b"),
            fileName: "stale-b.xlsx",
          }}
          toolbar={false}
        />
      )
    })

    const secondWorker = await waitForWorker(1)
    await emitWorkbook(secondWorker, [
      {
        name: "Second",
        rowCount: 1,
        columnCount: 1,
        entries: [{ cellIndex: 0, text: "second" }],
      },
    ])

    expect(await screen.findByRole("grid", { name: "Second" })).toBeTruthy()

    await emitWorkbook(firstWorker, [
      {
        name: "First",
        rowCount: 1,
        columnCount: 1,
        entries: [{ cellIndex: 0, text: "first" }],
      },
    ])

    expect(screen.getByRole("grid", { name: "Second" })).toBeTruthy()
    expect(screen.queryByRole("grid", { name: "First" })).toBeNull()
  })

  it("renders a spreadsheet parse error from the worker", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})

    await act(async () => {
      render(
        <XlsxViewer
          source={{
            kind: "url",
            url: uniqueXlsxUrl("worker-error"),
            fileName: "worker-error.xlsx",
          }}
        />
      )
    })

    const worker = await waitForWorker()
    await act(async () => {
      worker.onmessage?.({
        data: { type: "error", message: "bad workbook" },
      } as MessageEvent)
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    const alert = await screen.findByRole("alert")
    expect(alert.textContent).toContain("Couldn't parse this spreadsheet.")
    expect(alert.getAttribute("data-error-domain")).toBe("format")
    expect(alert.getAttribute("data-error-kind")).toBe("parse_failed")
    expect(worker.terminate).toHaveBeenCalledTimes(1)
  })

  it("renders a spreadsheet worker error when the worker crashes", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})

    await act(async () => {
      render(
        <XlsxViewer
          source={{
            kind: "url",
            url: uniqueXlsxUrl("worker-crash"),
            fileName: "worker-crash.xlsx",
          }}
        />
      )
    })

    const worker = await waitForWorker()
    await act(async () => {
      worker.onerror?.({ message: "worker exploded" } as ErrorEvent)
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    const alert = await screen.findByRole("alert")
    expect(alert.textContent).toContain("Couldn't parse this spreadsheet.")
    expect(alert.getAttribute("data-error-domain")).toBe("format")
    expect(alert.getAttribute("data-error-kind")).toBe("worker_failed")
    expect(worker.terminate).toHaveBeenCalledTimes(1)
  })
})
