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
import type {
  FileSystemItem,
  FileSystemQueryState,
} from "@/registry/new-york-v4/ui/file-system-types"

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

  it("filters by modified date preset", () => {
    const recentIso = new Date().toISOString()
    const datedItems: FileSystemItem[] = [
      {
        kind: "file",
        path: "dated/recent.txt",
        mimeType: "text/plain",
        updatedAt: recentIso,
      },
      {
        kind: "file",
        path: "dated/old.txt",
        mimeType: "text/plain",
        updatedAt: "2020-01-01T00:00:00Z",
      },
    ]

    render(<FileSystem defaultPath="dated/" items={datedItems} />)

    fireEvent.click(screen.getByRole("button", { name: "Modified 30d" }))

    expect(screen.getByRole("treeitem", { name: /recent.txt/i })).toBeTruthy()
    expect(screen.queryByRole("treeitem", { name: /old.txt/i })).toBeNull()
  })

  it("preserves selection and preview when switching views", async () => {
    render(<FileSystem defaultPath="reports/" items={items} />)

    fireEvent.click(screen.getByRole("treeitem", { name: /report.pdf/i }))
    await screen.findByText("report.pdf selected")

    fireEvent.click(screen.getByRole("tab", { name: "Grid view" }))

    expect(
      screen
        .getByRole("option", { name: /report.pdf/i })
        .getAttribute("aria-selected")
    ).toBe("true")
    expect(screen.getByText("report.pdf selected")).toBeTruthy()
    await waitFor(() => {
      expect(screen.getByTestId("file-viewer").textContent).toBe(
        "viewer:report.pdf"
      )
    })
  })

  it("opens files through onFileOpen instead of the built-in dialog", async () => {
    const onFileOpen = vi.fn()

    render(
      <FileSystem
        defaultPath="reports/"
        items={items}
        onFileOpen={onFileOpen}
      />
    )

    fireEvent.doubleClick(screen.getByRole("treeitem", { name: /report.pdf/i }))

    await waitFor(() => {
      expect(onFileOpen).toHaveBeenCalledWith(
        expect.objectContaining({ path: "reports/report.pdf" }),
        expect.objectContaining({ fileName: "report.pdf" })
      )
    })
    expect(screen.queryByRole("dialog")).toBeNull()
  })

  it("supports controlled query state", () => {
    function ControlledFileSystem() {
      const [query, setQuery] = React.useState<Partial<FileSystemQueryState>>({
        search: "report.pdf",
      })

      return (
        <FileSystem
          defaultPath="reports/"
          items={items}
          query={query}
          onQueryChange={setQuery}
        />
      )
    }

    render(<ControlledFileSystem />)

    expect(screen.getByRole("treeitem", { name: /report.pdf/i })).toBeTruthy()
    expect(screen.queryByRole("treeitem", { name: /table.csv/i })).toBeNull()

    fireEvent.change(screen.getByRole("searchbox", { name: "Search files" }), {
      target: { value: "table" },
    })

    expect(screen.getByRole("treeitem", { name: /table.csv/i })).toBeTruthy()
    expect(screen.queryByRole("treeitem", { name: /report.pdf/i })).toBeNull()
  })

  it("moves selection with grid keyboard controls", () => {
    render(
      <FileSystem defaultPath="reports/" defaultView="grid" items={items} />
    )

    const listbox = screen.getByRole("listbox", { name: "Files" })

    fireEvent.keyDown(listbox, { key: "ArrowRight" })
    expect(
      screen
        .getByRole("option", { name: /report.pdf/i })
        .getAttribute("aria-selected")
    ).toBe("true")

    fireEvent.keyDown(listbox, { key: "ArrowRight" })
    expect(
      screen
        .getByRole("option", { name: /table.csv/i })
        .getAttribute("aria-selected")
    ).toBe("true")
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
