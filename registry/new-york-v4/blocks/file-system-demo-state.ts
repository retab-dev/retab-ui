import type {
  FileSystemItem,
  FileSystemQueryState,
  FileSystemView,
} from "@/components/ui/file-system"

export const DEFAULT_FILE_SYSTEM_DEMO_QUERY: FileSystemQueryState = {
  filters: { categories: [], updatedAfter: null },
  search: "",
  sort: { direction: "asc", key: "name" },
}

export const FILE_SYSTEM_DEMO_ITEMS: FileSystemItem[] = [
  {
    kind: "folder",
    path: "financials/",
    updatedAt: "2026-04-11T15:20:00Z",
  },
  {
    kind: "folder",
    path: "research/",
    updatedAt: "2026-05-02T10:10:00Z",
  },
  {
    kind: "folder",
    path: "workspace/",
    updatedAt: "2026-05-14T08:30:00Z",
  },
  {
    kind: "file",
    path: "financials/nvidia-financials-fy2024.xlsx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    size: 231_482,
    source: {
      kind: "url",
      url: "/samples/nvidia-financials-fy2024.xlsx",
      fileName: "nvidia-financials-fy2024.xlsx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    },
    updatedAt: "2026-04-11T15:20:00Z",
  },
  {
    kind: "file",
    path: "financials/sales.csv",
    mimeType: "text/csv",
    size: 18_420,
    source: {
      kind: "url",
      url: "/samples/sales.csv",
      fileName: "sales.csv",
      mimeType: "text/csv",
    },
    updatedAt: "2026-04-08T09:12:00Z",
  },
  {
    kind: "file",
    path: "research/attention.pdf",
    mimeType: "application/pdf",
    previewImageUrl: "/samples/attention-page-1.png",
    size: 516_280,
    source: {
      kind: "url",
      url: "/samples/attention.pdf",
      fileName: "attention.pdf",
      mimeType: "application/pdf",
    },
    updatedAt: "2026-05-02T10:10:00Z",
  },
  {
    kind: "file",
    path: "research/an-image-is-worth-16x16-words.pdf",
    mimeType: "application/pdf",
    previewImageUrl: "/samples/an-image-is-worth-16x16-words-page-1.png",
    size: 298_114,
    source: {
      kind: "url",
      url: "/samples/an-image-is-worth-16x16-words.pdf",
      fileName: "an-image-is-worth-16x16-words.pdf",
      mimeType: "application/pdf",
    },
    updatedAt: "2026-04-19T13:45:00Z",
  },
  {
    kind: "file",
    path: "workspace/quarterly-business-review.docx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    size: 129_030,
    source: {
      kind: "url",
      url: "/samples/quarterly-business-review.docx",
      fileName: "quarterly-business-review.docx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    },
    updatedAt: "2026-05-14T08:30:00Z",
  },
  {
    kind: "file",
    path: "workspace/release-notes.md",
    mimeType: "text/markdown",
    size: 4_812,
    source: {
      kind: "url",
      url: "/samples/release-notes.md",
      fileName: "release-notes.md",
      mimeType: "text/markdown",
    },
    updatedAt: "2026-05-10T17:05:00Z",
  },
  {
    kind: "file",
    path: "workspace/use-debounced-value.ts",
    mimeType: "text/typescript",
    size: 2_190,
    source: {
      kind: "url",
      url: "/samples/use-debounced-value.ts",
      fileName: "use-debounced-value.ts",
      mimeType: "text/typescript",
    },
    updatedAt: "2026-05-09T11:15:00Z",
  },
]

export const LARGE_FILE_SYSTEM_DEMO_ITEMS: FileSystemItem[] = [
  {
    kind: "folder",
    path: "large/",
    updatedAt: "2026-06-01T00:00:00Z",
  },
  ...Array.from({ length: 5_000 }, (_, index): FileSystemItem => {
    const serial = index.toString().padStart(4, "0")

    return {
      kind: "file",
      path: `large/file-${serial}.pdf`,
      mimeType: "application/pdf",
      size: index + 1,
      source: {
        kind: "url",
        url: "/samples/attention.pdf",
        fileName: `file-${serial}.pdf`,
        mimeType: "application/pdf",
      },
      updatedAt: "2026-06-01T00:00:00Z",
    }
  }),
]

export type FileSystemDemoState = {
  path: string
  query: FileSystemQueryState
  selectedPath: string | null
  view: FileSystemView
}

const VIEWS: FileSystemView[] = ["list", "grid", "columns", "gallery"]
const SORT_KEYS: FileSystemQueryState["sort"]["key"][] = [
  "name",
  "kind",
  "size",
  "updatedAt",
]
const CATEGORIES = new Set(["csv", "docx", "markdown", "pdf", "text", "xlsx"])

export function collectFileSystemDemoItemPaths(
  items: readonly FileSystemItem[]
) {
  const paths = new Set<string>()

  for (const item of items) {
    paths.add(
      item.kind === "folder" ? normalizeFolderPath(item.path) : item.path
    )
  }

  return paths
}

export function collectFileSystemDemoFolderPaths(
  items: readonly FileSystemItem[]
) {
  const paths = new Set<string>([""])

  for (const item of items) {
    let path =
      item.kind === "folder"
        ? normalizeFolderPath(item.path)
        : pathParent(item.path)

    while (path) {
      paths.add(path)
      path = pathParent(path)
    }
  }

  return paths
}

export function parseFileSystemDemoState(
  searchParams: Pick<URLSearchParams, "get">,
  {
    fallbackState,
    folderPaths,
    itemPaths,
  }: {
    fallbackState: FileSystemDemoState
    folderPaths: ReadonlySet<string>
    itemPaths: ReadonlySet<string>
  }
): FileSystemDemoState {
  return {
    path: parsePath(searchParams.get("path"), folderPaths, fallbackState.path),
    query: parseQuery(searchParams, fallbackState.query),
    selectedPath: parseSelectedPath(
      searchParams.get("selectedPath"),
      itemPaths,
      fallbackState.selectedPath
    ),
    view: parseView(searchParams.get("view"), fallbackState.view),
  }
}

export function formatFileSystemDemoState(
  state: FileSystemDemoState,
  fallbackState: FileSystemDemoState
) {
  const searchParams = new URLSearchParams()
  const search = state.query.search.trim()

  if (state.path !== fallbackState.path) searchParams.set("path", state.path)
  if (search !== fallbackState.query.search) searchParams.set("search", search)
  if (
    state.selectedPath &&
    state.selectedPath !== fallbackState.selectedPath
  ) {
    searchParams.set("selectedPath", state.selectedPath)
  }
  if (state.view !== fallbackState.view) searchParams.set("view", state.view)
  if (state.query.filters.categories.length) {
    searchParams.set(
      "filters.categories",
      state.query.filters.categories.join(",")
    )
  }
  if (state.query.filters.updatedAfter) {
    searchParams.set("filters.updatedAfter", state.query.filters.updatedAfter)
  }
  if (state.query.sort.key !== fallbackState.query.sort.key) {
    searchParams.set("sort.key", state.query.sort.key)
  }
  if (state.query.sort.direction !== fallbackState.query.sort.direction) {
    searchParams.set("sort.direction", state.query.sort.direction)
  }

  return searchParams.toString()
}

function parseQuery(
  searchParams: Pick<URLSearchParams, "get">,
  fallbackQuery: FileSystemQueryState
): FileSystemQueryState {
  return {
    filters: {
      categories: parseCategories(searchParams.get("filters.categories")),
      updatedAfter: parseUpdatedAfter(searchParams.get("filters.updatedAfter")),
    },
    search: (searchParams.get("search") ?? fallbackQuery.search).trim(),
    sort: {
      direction: parseSortDirection(
        searchParams.get("sort.direction"),
        fallbackQuery.sort.direction
      ),
      key: parseSortKey(searchParams.get("sort.key"), fallbackQuery.sort.key),
    },
  }
}

function parsePath(
  value: string | null,
  folderPaths: ReadonlySet<string>,
  fallbackPath: string
) {
  if (!value) return fallbackPath
  const path = normalizeFolderPath(value)

  return folderPaths.has(path) ? path : fallbackPath
}

function parseSelectedPath(
  value: string | null,
  itemPaths: ReadonlySet<string>,
  fallbackSelectedPath: string | null
) {
  return value && itemPaths.has(value) ? value : fallbackSelectedPath
}

function parseView(value: string | null, fallbackView: FileSystemView) {
  return VIEWS.includes(value as FileSystemView)
    ? (value as FileSystemView)
    : fallbackView
}

function parseCategories(value: string | null) {
  if (!value) return []

  return value
    .split(",")
    .filter((category) => CATEGORIES.has(category))
    .sort()
}

function parseUpdatedAfter(
  value: string | null
): FileSystemQueryState["filters"]["updatedAfter"] {
  return value === "last7" || value === "last30" ? value : null
}

function parseSortKey(
  value: string | null,
  fallbackSortKey: FileSystemQueryState["sort"]["key"]
) {
  return SORT_KEYS.includes(value as FileSystemQueryState["sort"]["key"])
    ? (value as FileSystemQueryState["sort"]["key"])
    : fallbackSortKey
}

function parseSortDirection(
  value: string | null,
  fallbackSortDirection: FileSystemQueryState["sort"]["direction"]
) {
  return value === "desc" ? "desc" : fallbackSortDirection
}

function normalizeFolderPath(path: string | undefined | null): string {
  if (!path || path === "/") return ""
  const trimmed = path.replace(/^\/+/, "")
  return trimmed.endsWith("/") ? trimmed : `${trimmed}/`
}

function pathParent(path: string): string {
  const trimmed = path.endsWith("/") ? path.slice(0, -1) : path
  const separatorIndex = trimmed.lastIndexOf("/")

  return separatorIndex === -1 ? "" : `${trimmed.slice(0, separatorIndex)}/`
}
