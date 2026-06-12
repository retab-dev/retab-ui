// @vitest-environment jsdom

import * as React from "react"
import { act, cleanup, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { blobSource } from "@/registry/new-york-v4/lib/viewer-resource"
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

beforeEach(() => {
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
})
