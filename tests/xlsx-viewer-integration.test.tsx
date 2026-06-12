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
import { renderToStaticMarkup } from "react-dom/server"
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

const originalWorker = globalThis.Worker

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

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

beforeEach(() => {
  clearViewerResourceRegistryForTests()
  FakeXlsxWorker.instances = []
  vi.stubGlobal("ResizeObserver", ResizeObserverMock)
  Object.defineProperty(HTMLElement.prototype, "scrollTo", {
    configurable: true,
    value: vi.fn(),
  })
  globalThis.Worker = FakeXlsxWorker as unknown as typeof Worker
})

afterEach(() => {
  cleanup()
  clearViewerResourceRegistryForTests()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  globalThis.Worker = originalWorker
})

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

function workbookSource(identityKey: string) {
  return blobSource(new Uint8Array([1, 2, 3]), {
    identityKey,
    fileName: `${identityKey}.xlsx`,
  })
}

describe("XlsxViewer real grid integration", () => {
  it("does not render toolbar fallback chrome in toolbar-free server markup", () => {
    const html = renderToStaticMarkup(
      <XlsxViewer
        source={workbookSource("server-toolbarless")}
        toolbar={false}
      />
    )

    expect(html).toContain('data-slot="xlsx-viewer"')
    expect(html).toContain('data-slot="xlsx-grid"')
    expect(html).not.toContain("<button")
  })

  it("renders workbook cells into the real grid and exposes the viewport ref", async () => {
    const viewerRef = React.createRef<XlsxViewerHandle>()

    await act(async () => {
      render(
        <XlsxViewer
          ref={viewerRef}
          source={workbookSource("real-grid")}
          toolbar={false}
        />
      )
    })

    await emitWorkbook(await waitForWorker(), [
      {
        name: "Sheet A",
        rowCount: 2,
        columnCount: 2,
        entries: [
          { cellIndex: 0, text: "name" },
          { cellIndex: 3, text: "42", numeric: true },
        ],
      },
    ])

    const grid = await screen.findByRole("grid", { name: "Sheet A" })
    expect(grid.getAttribute("aria-rowcount")).toBe("2")
    expect(grid.getAttribute("aria-colcount")).toBe("2")
    expect(screen.getByTitle("name")).toBeTruthy()
    expect(screen.getByTitle("42").className).toContain("justify-end")
    expect(viewerRef.current?.getViewportElement()).toBe(grid)
  })

  it("renders an empty workbook as an empty synthetic first sheet", async () => {
    await act(async () => {
      render(<XlsxViewer source={workbookSource("empty-workbook-real")} />)
    })

    await emitWorkbook(await waitForWorker(), [])

    expect(await screen.findByText("Empty sheet")).toBeTruthy()
    expect(screen.getByRole("status").getAttribute("aria-label")).toBe(
      "Sheet 1 is empty"
    )
    expect(screen.getByText("-")).toBeTruthy()
    expect(screen.queryByRole("tablist")).toBeNull()
  })

  it("moves active-cell highlighting when the activeCell prop changes", async () => {
    const source = workbookSource("active-cell")
    let rerender!: ReturnType<typeof render>["rerender"]

    await act(async () => {
      const rendered = render(
        <XlsxViewer
          source={source}
          toolbar={false}
          activeCell={{ sheet: 0, row: 0, col: 1 }}
        />
      )
      rerender = rendered.rerender
    })

    await emitWorkbook(await waitForWorker(), [
      {
        name: "Active",
        rowCount: 2,
        columnCount: 2,
        entries: [
          { cellIndex: 0, text: "A1" },
          { cellIndex: 1, text: "B1" },
          { cellIndex: 2, text: "A2" },
          { cellIndex: 3, text: "B2" },
        ],
      },
    ])

    await screen.findByRole("grid", { name: "Active" })
    expect(screen.getByTitle("B1").className).toContain("ring-primary")

    await act(async () => {
      rerender(
        <XlsxViewer
          source={source}
          toolbar={false}
          activeCell={{ sheet: 0, row: 1, col: 0 }}
        />
      )
    })

    expect(screen.getByTitle("B1").className).not.toContain("ring-primary")
    expect(screen.getByTitle("A2").className).toContain("ring-primary")
  })

  it("updates toolbar sheet metadata and zoom display after load", async () => {
    await act(async () => {
      render(<XlsxViewer source={workbookSource("toolbar")} />)
    })

    await emitWorkbook(await waitForWorker(), [
      {
        name: "Metrics",
        rowCount: 12,
        columnCount: 4,
        entries: [{ cellIndex: 0, text: "metric" }],
      },
    ])

    expect(await screen.findByText("Metrics")).toBeTruthy()
    expect(screen.getByText("12 x 4")).toBeTruthy()
    expect(screen.getByText("100%")).toBeTruthy()

    fireEvent.click(screen.getByRole("button", { name: "Zoom in" }))
    expect(screen.getByText("120%")).toBeTruthy()

    fireEvent.click(screen.getByRole("button", { name: "Actual size" }))
    expect(screen.getByText("100%")).toBeTruthy()
  })
})
