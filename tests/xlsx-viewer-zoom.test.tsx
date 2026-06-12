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
import { XlsxViewer } from "@/registry/new-york-v4/ui/xlsx-viewer"

vi.mock("@/components/ui/xlsx-grid", async () => {
  const ReactMod = await import("react")
  return {
    XlsxGrid: ({ sheetName }: { sheetName: string }) =>
      ReactMod.createElement(
        "div",
        { role: "grid", "aria-label": sheetName },
        sheetName
      ),
    XlsxGridSkeleton: () =>
      ReactMod.createElement("div", { role: "status" }, "Loading grid"),
  }
})

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

beforeEach(() => {
  clearViewerResourceRegistryForTests()
  FakeXlsxWorker.instances = []
  globalThis.Worker = FakeXlsxWorker as unknown as typeof Worker
})

afterEach(() => {
  cleanup()
  clearViewerResourceRegistryForTests()
  vi.restoreAllMocks()
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
      data: { type: "workbook", sheets: sheets.map(createCompactSheet) },
    } as MessageEvent)
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
}

function clickMany(label: string, times: number) {
  for (let i = 0; i < times; i++) {
    fireEvent.click(screen.getByRole("button", { name: label }))
  }
}

describe("XlsxViewer zoom clamping", () => {
  beforeEach(async () => {
    await act(async () => {
      render(
        <XlsxViewer
          source={blobSource(new Uint8Array([1, 2, 3]), {
            identityKey: "blob:xlsx-zoom",
            fileName: "zoom.xlsx",
          })}
        />
      )
    })
    await emitWorkbook(await waitForWorker(), [
      {
        name: "Sheet1",
        rowCount: 1,
        columnCount: 1,
        entries: [{ cellIndex: 0, text: "x" }],
      },
    ])
    await screen.findByText("100%")
  })

  it("never zooms out past the 25% floor", () => {
    clickMany("Zoom out", 20)
    expect(screen.getByText("25%")).toBeTruthy()
  })

  it("never zooms in past the 500% ceiling", () => {
    clickMany("Zoom in", 20)
    expect(screen.getByText("500%")).toBeTruthy()
  })

  it("returns to 100% from either bound via Actual size", () => {
    clickMany("Zoom out", 20)
    fireEvent.click(screen.getByRole("button", { name: "Actual size" }))
    expect(screen.getByText("100%")).toBeTruthy()

    clickMany("Zoom in", 20)
    fireEvent.click(screen.getByRole("button", { name: "Actual size" }))
    expect(screen.getByText("100%")).toBeTruthy()
  })

  it("produces a single rounded zoom step", () => {
    fireEvent.click(screen.getByRole("button", { name: "Zoom in" }))
    expect(screen.getByText("120%")).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "Zoom out" }))
    expect(screen.getByText("100%")).toBeTruthy()
  })
})

describe("XlsxViewer multi-sheet tabs", () => {
  it("selects, clamps, and reports the active sheet across many tabs", async () => {
    const onSheetChange = vi.fn()
    await act(async () => {
      render(
        <XlsxViewer
          source={blobSource(new Uint8Array([1]), {
            identityKey: "blob:xlsx-many",
            fileName: "many.xlsx",
          })}
          toolbar={false}
          onSheetChange={onSheetChange}
        />
      )
    })
    await emitWorkbook(
      await waitForWorker(),
      Array.from({ length: 8 }, (_, index) => ({
        name: `S${index}`,
        rowCount: 1,
        columnCount: 1,
        entries: [{ cellIndex: 0, text: `v${index}` }],
      }))
    )

    await screen.findByRole("grid", { name: "S0" })
    fireEvent.click(screen.getByRole("tab", { name: "S7" }))
    expect(await screen.findByRole("grid", { name: "S7" })).toBeTruthy()
    expect(onSheetChange).toHaveBeenLastCalledWith(7)

    // Re-clicking the active tab is a no-op.
    fireEvent.click(screen.getByRole("tab", { name: "S7" }))
    expect(onSheetChange).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole("tab", { name: "S3" }))
    expect(await screen.findByRole("grid", { name: "S3" })).toBeTruthy()
    expect(onSheetChange).toHaveBeenCalledTimes(2)
    expect(onSheetChange).toHaveBeenLastCalledWith(3)
  })
})
