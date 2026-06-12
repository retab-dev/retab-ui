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

import {
  createHrefDownloadAction,
  ViewerDownloadError,
  type ViewerDownloadAction,
} from "@/registry/new-york-v4/lib/viewer-download"
import {
  triggerViewerDownload,
  ViewerDownloadControl,
} from "@/registry/new-york-v4/ui/viewer-download"

function mockObjectUrls(url = "blob:viewer-download") {
  const createObjectURL = vi.fn(() => url)
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
  const click = vi
    .spyOn(HTMLAnchorElement.prototype, "click")
    .mockImplementation(function (this: HTMLAnchorElement) {
      clicks.push({
        href: this.getAttribute("href"),
        download: this.download,
      })
    })
  return { click, clicks }
}

beforeEach(() => {
  mockObjectUrls()
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe("triggerViewerDownload", () => {
  it("downloads href payloads without creating object URLs", async () => {
    const { clicks } = captureAnchorClicks()

    await triggerViewerDownload(
      createHrefDownloadAction({
        id: "download-original",
        href: "/files/report.pdf",
        fileName: "report.pdf",
      })
    )

    expect(clicks).toEqual([
      { href: "/files/report.pdf", download: "report.pdf" },
    ])
    expect(URL.createObjectURL).not.toHaveBeenCalled()
  })

  it("downloads text payloads through a revoked object URL", async () => {
    const { clicks } = captureAnchorClicks()

    await triggerViewerDownload({
      id: "csv-export-table",
      label: "Export table",
      fileName: "data.csv",
      origin: "derived",
      getPayload: () => ({
        kind: "text",
        text: "a,b\n1,2",
        mimeType: "text/csv;charset=utf-8",
      }),
    })

    expect(URL.createObjectURL).toHaveBeenCalledWith(expect.any(Blob))
    expect(clicks).toEqual([
      { href: "blob:viewer-download", download: "data.csv" },
    ])
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:viewer-download")
  })

  it("models disabled actions as typed download errors", async () => {
    await expect(
      triggerViewerDownload({
        id: "disabled",
        label: "Download",
        fileName: "disabled.txt",
        origin: "original",
        isDisabled: true,
        getPayload: () => ({ kind: "none" }),
      })
    ).rejects.toMatchObject({
      name: "ViewerDownloadError",
      kind: "disabled",
      actionId: "disabled",
    } satisfies Partial<ViewerDownloadError>)
  })
})

describe("ViewerDownloadControl", () => {
  it("renders synchronous href actions as links", () => {
    render(
      <ViewerDownloadControl
        actions={[
          createHrefDownloadAction({
            id: "download-original",
            href: "/files/report.pdf",
            fileName: "report.pdf",
          }),
        ]}
      />
    )

    const link = screen.getByRole("link", { name: "Download" })
    expect(link.getAttribute("href")).toBe("/files/report.pdf")
    expect(link.getAttribute("download")).toBe("report.pdf")
  })

  it("defers derived payload creation until click", async () => {
    const getPayload = vi.fn(() => ({
      kind: "text" as const,
      text: "a,b\n1,2",
      mimeType: "text/csv;charset=utf-8",
    }))
    const { clicks } = captureAnchorClicks()

    render(
      <ViewerDownloadControl
        actions={[
          {
            id: "csv-export-table",
            label: "Export table",
            fileName: "data.csv",
            origin: "derived",
            getPayload,
          },
        ]}
      />
    )

    expect(screen.getByRole("button", { name: "Export table" })).toBeTruthy()
    expect(getPayload).not.toHaveBeenCalled()
    expect(URL.createObjectURL).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole("button", { name: "Export table" }))

    await waitFor(() => expect(getPayload).toHaveBeenCalledTimes(1))
    expect(URL.createObjectURL).toHaveBeenCalledWith(expect.any(Blob))
    expect(clicks).toEqual([
      { href: "blob:viewer-download", download: "data.csv" },
    ])
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:viewer-download")
  })

  it("contains failed generated downloads inside the control", async () => {
    const action: ViewerDownloadAction = {
      id: "broken-export",
      label: "Export table",
      fileName: "data.csv",
      origin: "derived",
      getPayload: () => Promise.reject(new Error("bad export")),
    }

    render(<ViewerDownloadControl actions={[action]} />)

    fireEvent.click(screen.getByRole("button", { name: "Export table" }))

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Export table" })).toBeTruthy()
    })
    expect(URL.createObjectURL).not.toHaveBeenCalled()
  })
})
