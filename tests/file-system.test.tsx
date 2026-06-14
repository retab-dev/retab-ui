// @vitest-environment jsdom
import * as React from "react"
import type * as PierreTreesReact from "@pierre/trees/react"
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import {
  FileSystem,
  FileSystemExplorer,
  FileSystemHeader,
  FileSystemOpenPreviewDialog,
  FileSystemProvider,
  FileSystemSelectedFile,
  useFileSystem,
} from "@/registry/new-york-v4/ui/file-system"
import type {
  FileSystemItem,
  FileSystemQueryState,
} from "@/registry/new-york-v4/ui/file-system-types"
import {
  ViewerBody,
  ViewerHeader,
  ViewerRoot,
  ViewerSidebar,
  ViewerSurface,
} from "@/registry/new-york-v4/ui/viewer"

const pierreModelSpies = vi.hoisted(() => ({
  models: new WeakSet<object>(),
  scrollToPath: vi.fn(),
}))

vi.mock("@pierre/trees/react", async (importOriginal) => {
  const actual = await importOriginal<typeof PierreTreesReact>()

  return {
    ...actual,
    useFileTree: (options: Parameters<typeof actual.useFileTree>[0]) => {
      const result = actual.useFileTree(options)

      if (!pierreModelSpies.models.has(result.model)) {
        pierreModelSpies.models.add(result.model)

        const scrollToPath = result.model.scrollToPath.bind(result.model)

        vi.spyOn(result.model, "scrollToPath").mockImplementation(
          (path, options) => {
            pierreModelSpies.scrollToPath(path, options)
            return scrollToPath(path, options)
          }
        )
      }

      return result
    },
  }
})

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
const defaultQuery: FileSystemQueryState = {
  search: "",
  sort: { direction: "asc", key: "name" },
}

function createDeferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((resolve_, reject_) => {
    resolve = resolve_
    reject = reject_
  })

  return { promise, reject, resolve }
}

function fileTreeShadowRoot() {
  const host = document.querySelector<HTMLElement>(
    "[data-slot='file-system-pierre-tree']"
  )

  if (!host?.shadowRoot) {
    throw new Error("Pierre file tree shadow root was not mounted")
  }

  return host.shadowRoot
}

function fileTreeHost() {
  const host = document.querySelector<HTMLElement>(
    "[data-slot='file-system-pierre-tree']"
  )

  if (!host) {
    throw new Error("Pierre file tree host was not mounted")
  }

  return host
}

function queryFileTreeItem(name: RegExp | string) {
  const matcher = typeof name === "string" ? new RegExp(`^${name}$`, "i") : name

  return [
    ...fileTreeShadowRoot().querySelectorAll<HTMLButtonElement>(
      "[role='treeitem']"
    ),
  ].find((item) =>
    matcher.test(item.getAttribute("aria-label") ?? item.textContent ?? "")
  )
}

function fileTreeItemLabels() {
  return [
    ...fileTreeShadowRoot().querySelectorAll<HTMLButtonElement>(
      "[role='treeitem']"
    ),
  ].map((item) => item.getAttribute("aria-label") ?? item.textContent ?? "")
}

async function expectFileTreeOrder(names: readonly string[]) {
  await waitFor(() => {
    const labels = fileTreeItemLabels()
    const indexes = names.map((name) =>
      labels.findIndex((label) => label.toLowerCase().includes(name))
    )

    for (const index of indexes) {
      expect(index).toBeGreaterThanOrEqual(0)
    }
    expect(indexes).toEqual([...indexes].sort((left, right) => left - right))
  })
}

async function findFileTreeItem(name: RegExp | string) {
  let item: HTMLButtonElement | undefined

  await waitFor(() => {
    item = queryFileTreeItem(name)
    expect(item).toBeTruthy()
  })

  if (!item) {
    throw new Error(`Pierre file tree item was not found: ${name.toString()}`)
  }

  return item
}

async function expandFileTreeItem(name: RegExp | string) {
  const item = await findFileTreeItem(name)

  if (item.getAttribute("aria-expanded") !== "true") {
    fireEvent.click(item)
  }

  await waitFor(() => {
    expect(queryFileTreeItem(name)?.getAttribute("aria-expanded")).toBe("true")
  })
  return item
}

async function collapseFileTreeItem(name: RegExp | string) {
  const item = await findFileTreeItem(name)

  if (item.getAttribute("aria-expanded") === "true") {
    fireEvent.click(item)
  }

  await waitFor(() => {
    expect(queryFileTreeItem(name)?.getAttribute("aria-expanded")).not.toBe(
      "true"
    )
  })
  return item
}

describe("FileSystem", () => {
  it("builds the easy file-system viewer from the explicit viewer primitive tree", () => {
    render(<FileSystem items={items} />)

    const root = document.querySelector<HTMLElement>(
      '[data-slot="viewer-root"]'
    )
    expect(root).toBeTruthy()
    expect(root?.getAttribute("data-viewer")).toBe("file-system")
    expect(document.querySelectorAll('[data-slot="viewer-root"]')).toHaveLength(
      1
    )
    expect(root?.children[0]?.getAttribute("data-slot")).toBe("viewer-header")
    expect(root?.children[1]?.getAttribute("data-slot")).toBe("viewer-body")

    const body = root?.querySelector<HTMLElement>('[data-slot="viewer-body"]')
    const sidebar = body?.querySelector<HTMLElement>(
      ':scope > [data-slot="viewer-sidebar"]'
    )
    const surface = body?.querySelector<HTMLElement>(
      ':scope > [data-slot="viewer-surface"]'
    )
    expect(sidebar).toBeTruthy()
    expect(surface).toBeTruthy()
    expect(body?.children[0]).toBe(sidebar)
    expect(body?.children[1]).toBe(surface)
    expect(sidebar?.getAttribute("aria-label")).toBe("Files")
    expect(sidebar?.style.getPropertyValue("--viewer-sidebar-width")).toBe(
      "min(22rem, 85vw)"
    )
    expect(sidebar?.className.split(/\s+/)).not.toContain("flex-1")
    expect(surface?.className.split(/\s+/)).toContain("flex-1")
    expect(surface?.className.split(/\s+/)).not.toContain("hidden")
  })

  it("composes file-system provider parts directly", async () => {
    render(
      <FileSystemProvider items={items}>
        <ViewerRoot>
          <ViewerHeader>
            <FileSystemHeader />
          </ViewerHeader>
          <ViewerBody>
            <ViewerSidebar>
              <FileSystemExplorer />
            </ViewerSidebar>
            <ViewerSurface>
              <FileSystemSelectedFile />
            </ViewerSurface>
          </ViewerBody>
        </ViewerRoot>
      </FileSystemProvider>
    )

    fireEvent.doubleClick(await findFileTreeItem(/reports/i))
    fireEvent.click(await findFileTreeItem(/report.pdf/i))

    await waitFor(() => {
      expect(screen.getByTestId("file-viewer").textContent).toBe(
        "viewer:report.pdf"
      )
    })
  })

  it("opens files from composed provider parts with the exported dialog", async () => {
    render(
      <FileSystemProvider defaultPath="reports/" items={items}>
        <ViewerRoot data-viewer="file-system" bare>
          <ViewerHeader>
            <FileSystemHeader />
          </ViewerHeader>
          <ViewerBody>
            <ViewerSidebar>
              <FileSystemExplorer />
            </ViewerSidebar>
            <ViewerSurface>
              <FileSystemSelectedFile />
            </ViewerSurface>
          </ViewerBody>
          <FileSystemOpenPreviewDialog />
        </ViewerRoot>
      </FileSystemProvider>
    )

    fireEvent.doubleClick(await findFileTreeItem(/report.pdf/i))

    const dialog = await screen.findByRole("dialog")
    expect(dialog.textContent).toContain("report.pdf")
    expect(dialog.textContent).toContain("viewer:report.pdf")
  })

  it("opens the selected list file from the keyboard", async () => {
    render(
      <FileSystemProvider defaultPath="reports/" items={items}>
        <ViewerRoot data-viewer="file-system" bare>
          <ViewerHeader>
            <FileSystemHeader />
          </ViewerHeader>
          <ViewerBody>
            <ViewerSidebar>
              <FileSystemExplorer />
            </ViewerSidebar>
            <ViewerSurface>
              <FileSystemSelectedFile />
            </ViewerSurface>
          </ViewerBody>
          <FileSystemOpenPreviewDialog />
        </ViewerRoot>
      </FileSystemProvider>
    )

    fireEvent.click(await findFileTreeItem(/report.pdf/i))
    fireEvent.keyDown(fileTreeHost(), { key: "Enter" })

    const dialog = await screen.findByRole("dialog")
    expect(dialog.textContent).toContain("report.pdf")
    expect(
      dialog.querySelector("[data-testid='file-viewer']")?.textContent
    ).toBe("viewer:report.pdf")
  })

  it("renders inferred folders and previews the selected file", async () => {
    render(<FileSystem items={items} />)

    fireEvent.doubleClick(await findFileTreeItem(/reports/i))
    fireEvent.click(await findFileTreeItem(/report.pdf/i))

    await waitFor(() => {
      expect(screen.getByTestId("file-viewer").textContent).toBe(
        "viewer:report.pdf"
      )
    })
  })

  it("sorts the list by size in both directions", async () => {
    const sortableItems: FileSystemItem[] = [
      {
        kind: "file",
        path: "alpha.txt",
        mimeType: "text/plain",
        size: 300,
      },
      {
        kind: "file",
        path: "bravo.txt",
        mimeType: "text/plain",
        size: 100,
      },
      {
        kind: "file",
        path: "charlie.txt",
        mimeType: "text/plain",
        size: 200,
      },
    ]

    render(<FileSystem items={sortableItems} />)

    fireEvent.click(screen.getByRole("button", { name: "Size" }))
    await expectFileTreeOrder(["alpha.txt", "charlie.txt", "bravo.txt"])

    fireEvent.click(screen.getByRole("button", { name: /Size/i }))
    await expectFileTreeOrder(["bravo.txt", "charlie.txt", "alpha.txt"])
  })

  it("sorts the list by modified date in both directions", async () => {
    const sortableItems: FileSystemItem[] = [
      {
        kind: "file",
        path: "alpha.txt",
        mimeType: "text/plain",
        updatedAt: "2026-01-01T00:00:00Z",
      },
      {
        kind: "file",
        path: "bravo.txt",
        mimeType: "text/plain",
        updatedAt: "2026-03-01T00:00:00Z",
      },
      {
        kind: "file",
        path: "charlie.txt",
        mimeType: "text/plain",
        updatedAt: "2025-01-01T00:00:00Z",
      },
    ]

    render(<FileSystem items={sortableItems} />)

    fireEvent.click(screen.getByRole("button", { name: "Modified" }))
    await expectFileTreeOrder(["bravo.txt", "alpha.txt", "charlie.txt"])

    fireEvent.click(screen.getByRole("button", { name: /^Modified$/i }))
    await expectFileTreeOrder(["charlie.txt", "alpha.txt", "bravo.txt"])
  })

  it("preserves selection and preview when switching views", async () => {
    render(<FileSystem defaultPath="reports/" items={items} />)

    fireEvent.click(await findFileTreeItem(/report.pdf/i))
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

    fireEvent.doubleClick(await findFileTreeItem(/report.pdf/i))

    await waitFor(() => {
      expect(onFileOpen).toHaveBeenCalledWith(
        expect.objectContaining({ path: "reports/report.pdf" }),
        expect.objectContaining({ fileName: "report.pdf" })
      )
    })
    expect(screen.queryByRole("dialog")).toBeNull()
  })

  it("supports controlled query state", async () => {
    function ControlledFileSystem() {
      const [query, setQuery] = React.useState<FileSystemQueryState>({
        ...defaultQuery,
        search: "report.pdf",
      })

      return (
        <FileSystem
          defaultPath="reports/"
          defaultView="grid"
          items={items}
          query={query}
          onQueryChange={setQuery}
        />
      )
    }

    render(<ControlledFileSystem />)

    expect(
      await screen.findByRole("option", { name: /report.pdf/i })
    ).toBeTruthy()
    expect(screen.queryByRole("option", { name: /table.csv/i })).toBeNull()

    fireEvent.change(screen.getByRole("searchbox", { name: "Search files" }), {
      target: { value: "table" },
    })

    expect(
      await screen.findByRole("option", { name: /table.csv/i })
    ).toBeTruthy()
    expect(screen.queryByRole("option", { name: /report.pdf/i })).toBeNull()
  })

  it("accepts partial default query state", async () => {
    render(
      <FileSystem
        defaultPath="reports/"
        defaultView="grid"
        defaultQuery={{ search: "report.pdf" }}
        items={items}
      />
    )

    expect(
      await screen.findByRole("option", { name: /report.pdf/i })
    ).toBeTruthy()
    expect(screen.queryByRole("option", { name: /table.csv/i })).toBeNull()
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

  it("opens the selected grid file from the keyboard", async () => {
    render(
      <FileSystem
        defaultPath="reports/"
        defaultView="grid"
        items={items}
      />
    )

    const listbox = screen.getByRole("listbox", { name: "Files" })

    fireEvent.keyDown(listbox, { key: "ArrowRight" })
    fireEvent.keyDown(listbox, { key: "Enter" })

    const dialog = await screen.findByRole("dialog")
    expect(dialog.textContent).toContain("report.pdf")
    expect(dialog.textContent).toContain("viewer:report.pdf")
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

    fireEvent.click(await findFileTreeItem(/lazy/i))
    await waitFor(() => {
      expect(fileTreeShadowRoot().textContent ?? "").toContain("first failure")
    })

    const row = await findFileTreeItem(/lazy/i)
    fireEvent.doubleClick(row)

    expect(await findFileTreeItem(/loaded.txt/i)).toBeTruthy()
  })

  it("expands retried folders by Pierre path after nested currentPath loads", async () => {
    const loadChildren = vi
      .fn()
      .mockRejectedValueOnce(new Error("first failure"))
      .mockResolvedValueOnce({
        items: [
          {
            kind: "file",
            path: "projects/lazy/loaded.txt",
            mimeType: "text/plain",
          },
        ],
      })
    const nestedItems: FileSystemItem[] = [
      { kind: "folder", path: "projects/lazy/", hasChildren: true },
      { kind: "file", path: "projects/other.txt", mimeType: "text/plain" },
    ]

    render(
      <FileSystem
        defaultPath="projects/"
        items={nestedItems}
        loadChildren={loadChildren}
      />
    )

    fireEvent.click(await findFileTreeItem(/lazy/i))
    await waitFor(() => {
      expect(fileTreeShadowRoot().textContent ?? "").toContain("first failure")
    })
    await waitFor(() => {
      expect(queryFileTreeItem(/lazy/i)?.getAttribute("aria-expanded")).toBe(
        "true"
      )
    })

    fireEvent.click(await findFileTreeItem(/other.txt/i))
    fireEvent.click(await findFileTreeItem(/lazy/i))

    expect(await findFileTreeItem(/loaded.txt/i)).toBeTruthy()
    expect(loadChildren).toHaveBeenLastCalledWith(
      expect.objectContaining({ path: "projects/lazy/" })
    )
  })

  it("preserves list expansion across folder decoration changes", async () => {
    const loadChildren = vi.fn().mockRejectedValue(new Error("load failed"))
    const lazyItems: FileSystemItem[] = [
      { kind: "file", path: "reports/report.pdf", mimeType: "application/pdf" },
      { kind: "folder", path: "lazy/", hasChildren: true },
    ]

    render(<FileSystem items={lazyItems} loadChildren={loadChildren} />)

    await expandFileTreeItem(/reports/i)
    expect(await findFileTreeItem(/report.pdf/i)).toBeTruthy()

    fireEvent.click(await findFileTreeItem(/lazy/i))
    await waitFor(() => {
      expect(fileTreeShadowRoot().textContent ?? "").toContain("load failed")
    })

    await waitFor(() => {
      expect(queryFileTreeItem(/reports/i)?.getAttribute("aria-expanded")).toBe(
        "true"
      )
    })
    expect(queryFileTreeItem(/report.pdf/i)).toBeTruthy()
  })

  it("scopes list expansion snapshots by currentPath", async () => {
    const scopedItems: FileSystemItem[] = [
      { kind: "file", path: "reports/report.pdf", mimeType: "application/pdf" },
      {
        kind: "file",
        path: "archive/reports/archive-report.pdf",
        mimeType: "application/pdf",
      },
      { kind: "file", path: "archive/summary.txt", mimeType: "text/plain" },
    ]

    render(<FileSystem items={scopedItems} />)

    await expandFileTreeItem(/^reports$/i)
    expect(await findFileTreeItem(/report.pdf/i)).toBeTruthy()

    fireEvent.doubleClick(await findFileTreeItem(/^archive$/i))
    expect(await findFileTreeItem(/summary.txt/i)).toBeTruthy()

    await waitFor(() => {
      expect(
        queryFileTreeItem(/^reports$/i)?.getAttribute("aria-expanded")
      ).not.toBe("true")
    })
    expect(queryFileTreeItem(/archive-report.pdf/i)).toBeUndefined()

    await expandFileTreeItem(/^reports$/i)
    expect(await findFileTreeItem(/archive-report.pdf/i)).toBeTruthy()

    fireEvent.click(screen.getByRole("button", { name: "Back" }))
    await waitFor(() => {
      expect(
        queryFileTreeItem(/^reports$/i)?.getAttribute("aria-expanded")
      ).toBe("true")
    })
    expect(queryFileTreeItem(/report.pdf/i)).toBeTruthy()

    fireEvent.click(screen.getByRole("button", { name: "Forward" }))
    await waitFor(() => {
      expect(
        queryFileTreeItem(/^reports$/i)?.getAttribute("aria-expanded")
      ).toBe("true")
    })
    expect(queryFileTreeItem(/archive-report.pdf/i)).toBeTruthy()
  })

  it("does not re-emit same-path selection after Pierre model reset", async () => {
    function LoadLazyFolderButton() {
      const { loading } = useFileSystem()

      return (
        <button
          type="button"
          onClick={() => {
            void loading.ensureChildren("lazy/")
          }}
        >
          Load lazy
        </button>
      )
    }

    const deferred = createDeferred<{ items: FileSystemItem[] }>()
    const loadChildren = vi.fn().mockReturnValue(deferred.promise)
    const onSelectionChange = vi.fn()
    const lazyItems: FileSystemItem[] = [
      { kind: "file", path: "report.pdf", mimeType: "application/pdf" },
      { kind: "folder", path: "lazy/", hasChildren: true },
    ]

    render(
      <FileSystemProvider
        defaultSelectedPath="report.pdf"
        items={lazyItems}
        loadChildren={loadChildren}
        onSelectionChange={onSelectionChange}
      >
        <ViewerRoot>
          <FileSystemExplorer />
          <LoadLazyFolderButton />
        </ViewerRoot>
      </FileSystemProvider>
    )

    expect(await findFileTreeItem(/report.pdf/i)).toBeTruthy()
    onSelectionChange.mockClear()

    fireEvent.click(screen.getByRole("button", { name: "Load lazy" }))

    await waitFor(() => {
      expect(fileTreeShadowRoot().textContent ?? "").toContain("Loading")
    })
    expect(onSelectionChange).not.toHaveBeenCalled()

    await act(async () => {
      deferred.resolve({ items: [] })
      await deferred.promise
    })
  })

  it("scrolls the selected list item after Pierre model reset", async () => {
    const sortableItems: FileSystemItem[] = [
      {
        kind: "file",
        path: "report.pdf",
        mimeType: "application/pdf",
        size: 300,
      },
      {
        kind: "file",
        path: "table.csv",
        mimeType: "text/csv",
        size: 100,
      },
    ]

    render(
      <FileSystem defaultSelectedPath="report.pdf" items={sortableItems} />
    )

    expect(await findFileTreeItem(/report.pdf/i)).toBeTruthy()
    pierreModelSpies.scrollToPath.mockClear()

    fireEvent.click(screen.getByRole("button", { name: "Size" }))

    await waitFor(() => {
      expect(pierreModelSpies.scrollToPath).toHaveBeenCalledWith(
        "report.pdf",
        undefined
      )
    })
  })

  it("restores list expansion after clearing search", async () => {
    const searchableItems: FileSystemItem[] = [
      { kind: "file", path: "reports/report.pdf", mimeType: "application/pdf" },
      { kind: "file", path: "archive/archive.txt", mimeType: "text/plain" },
    ]

    render(<FileSystem items={searchableItems} />)

    await expandFileTreeItem(/reports/i)
    expect(await findFileTreeItem(/report.pdf/i)).toBeTruthy()

    fireEvent.change(screen.getByRole("searchbox", { name: "Search files" }), {
      target: { value: "archive" },
    })
    expect(await findFileTreeItem(/archive.txt/i)).toBeTruthy()
    expect(queryFileTreeItem(/report.pdf/i)).toBeUndefined()

    fireEvent.change(screen.getByRole("searchbox", { name: "Search files" }), {
      target: { value: "" },
    })

    await waitFor(() => {
      expect(queryFileTreeItem(/reports/i)?.getAttribute("aria-expanded")).toBe(
        "true"
      )
    })
    expect(queryFileTreeItem(/report.pdf/i)).toBeTruthy()
  })

  it("does not let query expansion snapshots overwrite normal expansion", async () => {
    const searchableItems: FileSystemItem[] = [
      { kind: "file", path: "reports/report.pdf", mimeType: "application/pdf" },
      { kind: "file", path: "archive/archive.txt", mimeType: "text/plain" },
    ]

    render(<FileSystem items={searchableItems} />)

    await expandFileTreeItem(/^reports$/i)
    expect(await findFileTreeItem(/report.pdf/i)).toBeTruthy()
    expect(queryFileTreeItem(/archive.txt/i)).toBeUndefined()

    fireEvent.change(screen.getByRole("searchbox", { name: "Search files" }), {
      target: { value: "archive" },
    })
    expect(await findFileTreeItem(/archive.txt/i)).toBeTruthy()
    expect(queryFileTreeItem(/report.pdf/i)).toBeUndefined()

    fireEvent.change(screen.getByRole("searchbox", { name: "Search files" }), {
      target: { value: "report" },
    })
    expect(await findFileTreeItem(/report.pdf/i)).toBeTruthy()
    expect(queryFileTreeItem(/archive.txt/i)).toBeUndefined()

    fireEvent.change(screen.getByRole("searchbox", { name: "Search files" }), {
      target: { value: "" },
    })

    await waitFor(() => {
      expect(
        queryFileTreeItem(/^reports$/i)?.getAttribute("aria-expanded")
      ).toBe("true")
    })
    expect(queryFileTreeItem(/report.pdf/i)).toBeTruthy()
    expect(
      queryFileTreeItem(/^archive$/i)?.getAttribute("aria-expanded")
    ).not.toBe("true")
    expect(queryFileTreeItem(/archive.txt/i)).toBeUndefined()
  })

  it("keeps collapsed list folders collapsed after sorting", async () => {
    const sortableItems: FileSystemItem[] = [
      {
        kind: "file",
        path: "reports/report.pdf",
        mimeType: "application/pdf",
        size: 300,
      },
      {
        kind: "file",
        path: "archive/archive.txt",
        mimeType: "text/plain",
        size: 100,
      },
    ]

    render(<FileSystem items={sortableItems} />)

    await expandFileTreeItem(/reports/i)
    expect(await findFileTreeItem(/report.pdf/i)).toBeTruthy()

    await collapseFileTreeItem(/reports/i)
    expect(queryFileTreeItem(/report.pdf/i)).toBeUndefined()

    fireEvent.click(screen.getByRole("button", { name: "Size" }))

    await waitFor(() => {
      expect(
        queryFileTreeItem(/reports/i)?.getAttribute("aria-expanded")
      ).not.toBe("true")
    })
    expect(queryFileTreeItem(/report.pdf/i)).toBeUndefined()
  })

  it("selects the first lazy child from columns keyboard navigation", async () => {
    const loadChildren = vi.fn().mockResolvedValue({
      items: [
        {
          kind: "file",
          path: "lazy/loaded.txt",
          mimeType: "text/plain",
        },
      ],
    })
    const lazyItems: FileSystemItem[] = [
      { kind: "folder", path: "lazy/", hasChildren: true },
    ]

    render(
      <FileSystem
        defaultView="columns"
        items={lazyItems}
        loadChildren={loadChildren}
      />
    )

    fireEvent.click(screen.getByRole("option", { name: /lazy/i }))
    fireEvent.keyDown(screen.getByRole("listbox", { name: "Files" }), {
      key: "ArrowRight",
    })

    await waitFor(() => {
      expect(
        screen
          .getByRole("option", { name: /loaded.txt/i })
          .getAttribute("aria-selected")
      ).toBe("true")
    })
  })

  it("does not select a lazy child after selection changes before load resolves", async () => {
    const deferred = createDeferred<{ items: FileSystemItem[] }>()
    const loadChildren = vi.fn().mockReturnValue(deferred.promise)
    const onSelectionChange = vi.fn()
    const lazyItems: FileSystemItem[] = [
      { kind: "folder", path: "lazy/", hasChildren: true },
      { kind: "file", path: "other.txt", mimeType: "text/plain" },
    ]

    render(
      <FileSystem
        defaultView="columns"
        items={lazyItems}
        loadChildren={loadChildren}
        onSelectionChange={onSelectionChange}
      />
    )

    fireEvent.click(screen.getByRole("option", { name: /lazy/i }))
    fireEvent.keyDown(screen.getByRole("listbox", { name: "Files" }), {
      key: "ArrowRight",
    })
    fireEvent.click(screen.getByRole("option", { name: /other.txt/i }))

    await screen.findByText("other.txt selected")
    await act(async () => {
      deferred.resolve({
        items: [
          {
            kind: "file",
            path: "lazy/loaded.txt",
            mimeType: "text/plain",
          },
        ],
      })
      await deferred.promise
    })

    await waitFor(() => {
      expect(screen.getByText("other.txt selected")).toBeTruthy()
    })
    expect(onSelectionChange).not.toHaveBeenCalledWith(
      expect.objectContaining({ path: "lazy/loaded.txt" })
    )
  })

  it("does not select a lazy child after navigation changes before load resolves", async () => {
    const deferred = createDeferred<{ items: FileSystemItem[] }>()
    const loadChildren = vi.fn().mockReturnValue(deferred.promise)
    const onSelectionChange = vi.fn()
    const lazyItems: FileSystemItem[] = [
      { kind: "folder", path: "lazy/", hasChildren: true },
      { kind: "file", path: "stable/stable.txt", mimeType: "text/plain" },
    ]

    render(
      <FileSystem
        defaultView="columns"
        items={lazyItems}
        loadChildren={loadChildren}
        onSelectionChange={onSelectionChange}
      />
    )

    fireEvent.click(screen.getByRole("option", { name: /lazy/i }))
    fireEvent.keyDown(screen.getByRole("listbox", { name: "Files" }), {
      key: "ArrowRight",
    })
    fireEvent.doubleClick(screen.getByRole("option", { name: /stable/i }))

    expect(
      await screen.findByRole("option", { name: /stable.txt/i })
    ).toBeTruthy()
    await act(async () => {
      deferred.resolve({
        items: [
          {
            kind: "file",
            path: "lazy/loaded.txt",
            mimeType: "text/plain",
          },
        ],
      })
      await deferred.promise
    })

    await waitFor(() => {
      expect(screen.queryByText("loaded.txt selected")).toBeNull()
    })
    expect(onSelectionChange).not.toHaveBeenCalledWith(
      expect.objectContaining({ path: "lazy/loaded.txt" })
    )
  })

  it("keeps the lazy folder selected when column child loading fails", async () => {
    const loadChildren = vi.fn().mockRejectedValue(new Error("load failed"))
    const lazyItems: FileSystemItem[] = [
      { kind: "folder", path: "lazy/", hasChildren: true },
    ]

    render(
      <FileSystem
        defaultView="columns"
        items={lazyItems}
        loadChildren={loadChildren}
      />
    )

    fireEvent.click(screen.getByRole("option", { name: /lazy/i }))
    fireEvent.keyDown(screen.getByRole("listbox", { name: "Files" }), {
      key: "ArrowRight",
    })

    await waitFor(() => {
      expect(
        screen
          .getByRole("option", { name: /lazy/i })
          .getAttribute("aria-selected")
      ).toBe("true")
    })
    fireEvent.click(screen.getByRole("tab", { name: "List view" }))
    await waitFor(() => {
      expect(fileTreeShadowRoot().textContent ?? "").toContain("load failed")
    })
    expect(loadChildren).toHaveBeenCalled()
  })

  it("keeps large list DOM bounded through Pierre virtualization", async () => {
    const largeItems: FileSystemItem[] = Array.from(
      { length: 1000 },
      (_, index) => ({
        kind: "file",
        path: `files/file-${String(index).padStart(4, "0")}.txt`,
        mimeType: "text/plain",
      })
    )

    render(<FileSystem defaultPath="files/" items={largeItems} />)

    expect(await findFileTreeItem(/file-0000.txt/i)).toBeTruthy()
    expect(
      fileTreeShadowRoot().querySelectorAll("[role='treeitem']").length
    ).toBeLessThan(120)
  })

  it("clears resolved source cache when same-path items change", async () => {
    function SourceSwapFileSystem() {
      const [version, setVersion] = React.useState(1)
      const versionedItems = React.useMemo<FileSystemItem[]>(
        () => [
          {
            kind: "file",
            path: "report.pdf",
            mimeType: "application/pdf",
            metadata: { version: String(version) },
          },
        ],
        [version]
      )
      const resolveSource = React.useCallback(
        async () => ({
          kind: "url" as const,
          url: `/report-v${version}.pdf`,
          fileName: `report-v${version}.pdf`,
          mimeType: "application/pdf",
        }),
        [version]
      )

      return (
        <>
          <button type="button" onClick={() => setVersion(2)}>
            Swap source
          </button>
          <FileSystem
            defaultSelectedPath="report.pdf"
            items={versionedItems}
            resolveSource={resolveSource}
          />
        </>
      )
    }

    render(<SourceSwapFileSystem />)

    await waitFor(() => {
      expect(screen.getByTestId("file-viewer").textContent).toBe(
        "viewer:report-v1.pdf"
      )
    })

    fireEvent.click(screen.getByRole("button", { name: "Swap source" }))

    await waitFor(() => {
      expect(screen.getByTestId("file-viewer").textContent).toBe(
        "viewer:report-v2.pdf"
      )
    })
  })
})
