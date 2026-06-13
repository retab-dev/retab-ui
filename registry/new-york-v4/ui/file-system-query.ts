import { detectCategory } from "@/lib/viewer-source"

import { compareEntryNames } from "./file-system-index"
import type {
  FileSystemEntry,
  FileSystemFileEntry,
  FileSystemFilterState,
  FileSystemIndex,
  FileSystemQueryState,
  FileSystemSortState,
} from "./file-system-types"

export const DEFAULT_FILE_SYSTEM_SORT: FileSystemSortState = {
  direction: "asc",
  key: "name",
}

export const DEFAULT_FILE_SYSTEM_QUERY: FileSystemQueryState = {
  filters: { categories: [], updatedAfter: null },
  search: "",
  sort: DEFAULT_FILE_SYSTEM_SORT,
}

export function createFileSystemQueryState(
  query: Partial<FileSystemQueryState> | undefined
): FileSystemQueryState {
  return {
    filters: {
      categories: query?.filters?.categories ?? [],
      updatedAfter: query?.filters?.updatedAfter ?? null,
    },
    search: query?.search ?? "",
    sort: {
      direction: query?.sort?.direction ?? DEFAULT_FILE_SYSTEM_SORT.direction,
      key: query?.sort?.key ?? DEFAULT_FILE_SYSTEM_SORT.key,
    },
  }
}

export function normalizeFileSystemSearch(value: string): string {
  return value.trim().toLowerCase()
}

export function getFileSystemCategory(file: FileSystemFileEntry) {
  return detectCategory(file.name, file.mimeType)
}

export function getFileSystemCategoryLabel(category: string) {
  switch (category) {
    case "csv":
      return "CSV"
    case "docx":
      return "Word"
    case "html":
      return "HTML"
    case "image":
      return "Image"
    case "markdown":
      return "Markdown"
    case "pdf":
      return "PDF"
    case "pptx":
      return "PowerPoint"
    case "text":
      return "Text"
    case "xlsx":
      return "Excel"
    default:
      return "Unsupported"
  }
}

export function fileMatchesQuery(
  file: FileSystemFileEntry,
  query: FileSystemQueryState
) {
  const search = normalizeFileSystemSearch(query.search)
  if (
    search &&
    !file.path.toLowerCase().includes(search) &&
    !file.name.toLowerCase().includes(search)
  ) {
    return false
  }

  if (
    query.filters.categories.length &&
    !query.filters.categories.includes(getFileSystemCategory(file))
  ) {
    return false
  }

  const cutoff = dateModifiedCutoff(query.filters.updatedAfter)
  if (cutoff) {
    const fileTime = Date.parse(file.updatedAt ?? file.createdAt ?? "")

    if (Number.isNaN(fileTime) || fileTime < cutoff.getTime()) return false
  }

  return true
}

export function deriveVisibleIndex(
  index: FileSystemIndex,
  currentPath: string,
  query: FileSystemQueryState
): FileSystemIndex {
  const search = normalizeFileSystemSearch(query.search)
  const hasCategoryFilter = query.filters.categories.length > 0
  const hasDateFilter = query.filters.updatedAfter !== null

  if (!search && !hasCategoryFilter && !hasDateFilter)
    return sortFileSystemIndex(index, query.sort)

  const visiblePaths = new Set<string>()
  const markVisible = (path: string) => {
    let nextPath = path

    while (
      nextPath &&
      nextPath !== currentPath &&
      !visiblePaths.has(nextPath)
    ) {
      visiblePaths.add(nextPath)
      const trimmed = nextPath.endsWith("/") ? nextPath.slice(0, -1) : nextPath
      const separatorIndex = trimmed.lastIndexOf("/")

      nextPath =
        separatorIndex === -1 ? "" : `${trimmed.slice(0, separatorIndex)}/`
    }
  }

  for (const [path, file] of index.files) {
    if (currentPath && !path.startsWith(currentPath)) continue
    if (!fileMatchesQuery(file, query)) continue
    visiblePaths.add(path)
    markVisible(file.parentPath)
  }

  if (!hasCategoryFilter) {
    for (const [path, folder] of index.folders) {
      if (currentPath && !path.startsWith(currentPath)) continue
      if (
        search &&
        !path.toLowerCase().includes(search) &&
        !folder.name.toLowerCase().includes(search)
      ) {
        continue
      }
      visiblePaths.add(path)
      markVisible(folder.parentPath)
    }
  }

  const children = new Map<string, FileSystemEntry[]>()

  for (const [parentPath, entries] of index.children) {
    const visibleEntries = entries.filter((entry) =>
      visiblePaths.has(entry.path)
    )
    if (visibleEntries.length) children.set(parentPath, visibleEntries)
  }

  return sortFileSystemIndex({ ...index, children }, query.sort)
}

export function sortFileSystemIndex(
  index: FileSystemIndex,
  sort: FileSystemSortState
) {
  if (
    sort.key === DEFAULT_FILE_SYSTEM_SORT.key &&
    sort.direction === DEFAULT_FILE_SYSTEM_SORT.direction
  ) {
    return index
  }

  const children = new Map<string, FileSystemEntry[]>()

  for (const [parentPath, entries] of index.children) {
    children.set(
      parentPath,
      [...entries].sort((left, right) => compareEntries(left, right, sort))
    )
  }

  return { ...index, children } satisfies FileSystemIndex
}

export function compareEntries(
  left: FileSystemEntry,
  right: FileSystemEntry,
  sort: FileSystemSortState
) {
  if (left.kind !== right.kind) return left.kind === "folder" ? -1 : 1

  let result = 0

  switch (sort.key) {
    case "kind":
      result = entryKindLabel(left).localeCompare(entryKindLabel(right))
      break
    case "size":
      result = (entrySize(left) ?? -1) - (entrySize(right) ?? -1)
      break
    case "updatedAt":
      result = entryTime(left) - entryTime(right)
      break
    case "name":
      result = compareEntryNames(left, right)
      break
  }

  if (result === 0) result = compareEntryNames(left, right)
  return sort.direction === "asc" ? result : -result
}

export function collectFileSystemCategories(index: FileSystemIndex) {
  const categories = new Set<string>()

  for (const file of index.files.values()) {
    categories.add(getFileSystemCategory(file))
  }

  return [...categories].sort((left, right) =>
    getFileSystemCategoryLabel(left).localeCompare(
      getFileSystemCategoryLabel(right)
    )
  )
}

export function entryKindLabel(entry: FileSystemEntry) {
  return entry.kind === "folder"
    ? "Folder"
    : getFileSystemCategoryLabel(getFileSystemCategory(entry))
}

function entrySize(entry: FileSystemEntry) {
  return entry.kind === "file" ? entry.size : undefined
}

function entryTime(entry: FileSystemEntry) {
  const time = Date.parse(entry.updatedAt ?? entry.createdAt ?? "")
  return Number.isNaN(time) ? Number.NEGATIVE_INFINITY : time
}

export function fileSystemFilterIsEmpty(filters: FileSystemFilterState) {
  return filters.categories.length === 0 && filters.updatedAfter === null
}

export function dateModifiedCutoff(
  preset: FileSystemFilterState["updatedAfter"]
) {
  if (!preset) return null

  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - (preset === "last7" ? 7 : 30))
  return cutoff
}

export function dateModifiedFilterLabel(
  preset: FileSystemFilterState["updatedAfter"]
) {
  if (preset === "last7") return "Modified 7d"
  if (preset === "last30") return "Modified 30d"
  return "Modified"
}
