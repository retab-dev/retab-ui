// @vitest-environment jsdom
import * as React from "react"
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { FileSystem } from "@/registry/new-york-v4/ui/file-system"
import type { FileSystemItem } from "@/registry/new-york-v4/ui/file-system-types"

vi.mock("@/components/ui/file-viewer", () => ({
  FileViewer: ({ source }: { source: { fileName?: string } }) => (
    <div data-testid="file-viewer">viewer:{source.fileName}</div>
  ),
}))

vi.mock("@/components/ui/file-thumbnail", () => ({
  FileThumbnail: ({
    file,
    source,
  }: {
    file?: { name: string }
    source?: { fileName?: string }
  }) => (
    <span data-testid="file-thumbnail">{source?.fileName ?? file?.name}</span>
  ),
}))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

const items: FileSystemItem[] = [
  {
    kind: "file",
    path: "reports/report.pdf",
    mimeType: "application/pdf",
    source: {
      kind: "url",
      url: "/report.pdf",
      fileName: "report.pdf",
      mimeType: "application/pdf",
    },
    updatedAt: "2026-01-01T00:00:00Z",
  },
  {
    kind: "file",
    path: "reports/table.csv",
    mimeType: "text/csv",
    source: {
      kind: "url",
      url: "/table.csv",
      fileName: "table.csv",
      mimeType: "text/csv",
    },
  },
]

describe("FileSystem", () => {
  it("renders inferred folders and previews the selected file", async () => {
    render(<FileSystem items={items} />)

    fireEvent.doubleClick(screen.getByRole("treeitem", { name: /reports/i }))
    fireEvent.click(screen.getByRole("treeitem", { name: /report.pdf/i }))

    await waitFor(() => {
      expect(screen.getByTestId("file-viewer").textContent).toBe(
        "viewer:report.pdf"
      )
    })
  })

  it("filters by file category", () => {
    render(<FileSystem defaultPath="reports/" items={items} />)

    fireEvent.click(screen.getByRole("button", { name: "CSV" }))

    expect(screen.getByRole("treeitem", { name: /table.csv/i })).toBeTruthy()
    expect(screen.queryByRole("treeitem", { name: /report.pdf/i })).toBeNull()
  })

  it("loads lazy folders and retries failed folder loads", async () => {
    const loadChildren = vi
      .fn()
      .mockRejectedValueOnce(new Error("first failure"))
      .mockResolvedValueOnce({
        items: [
          {
            kind: "file",
            path: "lazy/loaded.txt",
            mimeType: "text/plain",
            source: {
              kind: "text",
              text: "loaded",
              fileName: "loaded.txt",
              mimeType: "text/plain",
            },
          },
        ],
      })
    const lazyItems: FileSystemItem[] = [
      { kind: "folder", path: "lazy/", hasChildren: true },
    ]

    render(<FileSystem items={lazyItems} loadChildren={loadChildren} />)

    fireEvent.click(screen.getByRole("treeitem", { name: /lazy/i }))
    await screen.findByText("first failure")

    const row = screen.getByRole("treeitem", { name: /lazy/i })
    fireEvent.click(within(row).getByText("first failure"))
    fireEvent.doubleClick(row)

    await waitFor(() => {
      expect(screen.getByRole("treeitem", { name: /loaded.txt/i })).toBeTruthy()
    })
  })
})
