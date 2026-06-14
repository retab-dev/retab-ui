"use client"

import {
  buildFileSystemIndex,
  normalizeFilePath,
  normalizeFolderPath,
} from "./file-system-index"
import {
  createFileSystemQueryState,
  DEFAULT_FILE_SYSTEM_QUERY,
  deriveVisibleIndex,
} from "./file-system-query"
import type {
  FileSystemEntry,
  FileSystemFileEntry,
  FileSystemFolderEntry,
  FileSystemIndex,
  FileSystemItem,
  FileSystemQueryState,
  FileSystemSortKey,
  FileSystemView,
} from "./file-system-types"

export type FileSystemHistoryState = {
  back: string[]
  forward: string[]
}

export type FileSystemTreeState = {
  childrenByPath: Map<string, string[]>
  entriesByPath: Map<string, FileSystemEntry>
}

export type FileSystemFolderLoadReason =
  | "navigate"
  | "expand"
  | "retry"
  | "reveal-selection"

export type FileSystemFolderLoadState =
  | { status: "loaded" }
  | { status: "loading"; requestId: string; reason: FileSystemFolderLoadReason }
  | { status: "failed"; error: string }

export type FileSystemFolderLoadStateByPath = Map<
  string,
  FileSystemFolderLoadState
>

export type FileSystemPathChangeSource =
  | "controlled-prop"
  | "history"
  | "reveal"
  | "user"

export type FileSystemEventSource = "controlled-prop" | "user"

export type FileSystemKernelState = {
  folders: FileSystemFolderLoadStateByPath
  history: FileSystemHistoryState
  path: string
  query: FileSystemQueryState
  selectionPath: string | null
  tree: FileSystemTreeState
  view: FileSystemView
}

export type FileSystemKernelEvent =
  | { items: readonly FileSystemItem[]; type: "items.replaced" }
  | { type: "path.changed"; path: string; source: FileSystemPathChangeSource }
  | { type: "history.back" }
  | { type: "history.forward" }
  | {
      type: "query.changed"
      query: FileSystemQueryState
      source: FileSystemEventSource
    }
  | { type: "query.searchChanged"; search: string }
  | { type: "query.sortKeyChanged"; key: FileSystemSortKey }
  | { type: "view.changed"; source: FileSystemEventSource; view: FileSystemView }
  | { path: string | null; source: FileSystemEventSource; type: "entry.selected" }
  | { path: string; type: "entry.openRequested" }
  | {
      path: string
      reason: FileSystemFolderLoadReason
      requestId: string
      type: "folder.loadRequested"
    }
  | {
      items: FileSystemItem[]
      path: string
      requestId: string
      type: "folder.loadSucceeded"
    }
  | {
      error: string
      path: string
      requestId: string
      type: "folder.loadFailed"
    }

export type FileSystemKernelCommand =
  | {
      path: string
      reason: FileSystemFolderLoadReason
      requestId: string
      type: "folder.ensure"
    }
  | { path: string; type: "callback.pathChanged" }
  | { query: FileSystemQueryState; type: "callback.queryChanged" }
  | { view: FileSystemView; type: "callback.viewChanged" }
  | { entry: FileSystemEntry | null; type: "callback.selectionChanged" }
  | { file: FileSystemFileEntry; type: "file.open" }

export type FileSystemKernelResult = {
  commands: FileSystemKernelCommand[]
  state: FileSystemKernelState
}

export function createFileSystemKernelState({
  defaultPath = "",
  defaultQuery,
  defaultSelectedPath = null,
  defaultView = "list",
  items,
}: {
  defaultPath?: string
  defaultQuery?: Partial<FileSystemQueryState>
  defaultSelectedPath?: string | null
  defaultView?: FileSystemView
  items: readonly FileSystemItem[]
}): FileSystemKernelState {
  const tree = createFileSystemTreeState(items)
  const requestedPath = normalizeFolderPath(defaultPath)
  const path = isKnownFolderPath(tree, requestedPath) ? requestedPath : ""
  const selectionPath = normalizeSelectionPath(tree, defaultSelectedPath)

  return {
    folders: new Map(),
    history: { back: [], forward: [] },
    path,
    query: createFileSystemQueryState(defaultQuery),
    selectionPath,
    tree,
    view: defaultView,
  }
}

export function reduceFileSystemKernel(
  state: FileSystemKernelState,
  event: FileSystemKernelEvent
): FileSystemKernelResult {
  switch (event.type) {
    case "items.replaced":
      return reduceItemsReplaced(state, event.items)
    case "path.changed":
      return reducePathChanged(state, event)
    case "history.back":
      return reduceHistoryBack(state)
    case "history.forward":
      return reduceHistoryForward(state)
    case "query.changed":
      return reduceQueryChanged(state, event.query, event.source)
    case "query.searchChanged":
      return reduceQueryChanged(
        state,
        { ...state.query, search: event.search },
        "user"
      )
    case "query.sortKeyChanged":
      return reduceQueryChanged(
        state,
        { ...state.query, sort: nextSort(state.query, event.key) },
        "user"
      )
    case "view.changed":
      return reduceViewChanged(state, event.view, event.source)
    case "entry.selected":
      return reduceEntrySelected(state, event.path, event.source)
    case "entry.openRequested":
      return reduceEntryOpenRequested(state, event.path)
    case "folder.loadRequested":
      return reduceFolderLoadRequested(state, event)
    case "folder.loadSucceeded":
      return reduceFolderLoadSucceeded(state, event)
    case "folder.loadFailed":
      return reduceFolderLoadFailed(state, event)
  }
}

function reduceItemsReplaced(
  state: FileSystemKernelState,
  items: readonly FileSystemItem[]
): FileSystemKernelResult {
  const tree = createFileSystemTreeState(items)
  const path = isKnownFolderPath(tree, state.path) ? state.path : ""
  const selectionPath = normalizeSelectionPath(tree, state.selectionPath)

  return {
    commands: [],
    state: {
      ...state,
      folders: new Map(),
      path,
      selectionPath,
      tree,
    },
  }
}

export function createFileSystemTreeState(
  items: readonly FileSystemItem[]
): FileSystemTreeState {
  return fileSystemTreeFromIndex(buildFileSystemIndex(items))
}

export function fileSystemTreeToIndex(
  tree: FileSystemTreeState
): FileSystemIndex {
  const folders = new Map<string, FileSystemFolderEntry>()
  const files = new Map<string, FileSystemFileEntry>()
  const children = new Map<string, FileSystemEntry[]>()

  for (const [path, entry] of tree.entriesByPath) {
    if (entry.kind === "folder") {
      folders.set(path, entry)
    } else {
      files.set(path, entry)
    }
  }

  for (const [parentPath, childPaths] of tree.childrenByPath) {
    const entries = childPaths
      .map((path) => tree.entriesByPath.get(path))
      .filter((entry): entry is FileSystemEntry => Boolean(entry))

    if (entries.length) children.set(parentPath, entries)
  }

  return { children, files, folders }
}

export function mergeFileSystemTreeItems({
  items,
  tree,
}: {
  items: readonly FileSystemItem[]
  tree: FileSystemTreeState
}) {
  return createFileSystemTreeState([...tree.entriesByPath.values(), ...items])
}

export function normalizeFileSystemEntryPath(
  path: string | null | undefined
) {
  if (!path) return null

  return path.endsWith("/") ? normalizeFolderPath(path) : normalizeFilePath(path)
}

function fileSystemTreeFromIndex(index: FileSystemIndex): FileSystemTreeState {
  const entriesByPath = new Map<string, FileSystemEntry>()
  const childrenByPath = new Map<string, string[]>()

  for (const [path, folder] of index.folders) entriesByPath.set(path, folder)
  for (const [path, file] of index.files) entriesByPath.set(path, file)
  for (const [path, children] of index.children) {
    childrenByPath.set(
      path,
      children.map((entry) => entry.path)
    )
  }

  return { childrenByPath, entriesByPath }
}

function reducePathChanged(
  state: FileSystemKernelState,
  event: Extract<FileSystemKernelEvent, { type: "path.changed" }>
): FileSystemKernelResult {
  const path = normalizeFolderPath(event.path)
  const nextPath = isKnownFolderPath(state.tree, path) ? path : ""

  if (nextPath === state.path) return unchanged(state)

  const nextState: FileSystemKernelState = {
    ...state,
    history:
      event.source === "user"
        ? { back: [...state.history.back, state.path], forward: [] }
        : state.history,
    path: nextPath,
    query:
      event.source === "user" || event.source === "history"
        ? { ...state.query, search: "" }
        : state.query,
    selectionPath: null,
  }
  const commands: FileSystemKernelCommand[] =
    event.source === "controlled-prop"
      ? []
      : [
          { path: nextPath, type: "callback.pathChanged" },
          { entry: null, type: "callback.selectionChanged" },
        ]

  return { commands, state: nextState }
}

function reduceHistoryBack(
  state: FileSystemKernelState
): FileSystemKernelResult {
  const path = state.history.back.at(-1)
  if (path === undefined) return unchanged(state)

  return {
    commands: [
      { path, type: "callback.pathChanged" },
      { entry: null, type: "callback.selectionChanged" },
    ],
    state: {
      ...state,
      history: {
        back: state.history.back.slice(0, -1),
        forward: [state.path, ...state.history.forward],
      },
      path,
      query: { ...state.query, search: "" },
      selectionPath: null,
    },
  }
}

function reduceHistoryForward(
  state: FileSystemKernelState
): FileSystemKernelResult {
  const path = state.history.forward[0]
  if (path === undefined) return unchanged(state)

  return {
    commands: [
      { path, type: "callback.pathChanged" },
      { entry: null, type: "callback.selectionChanged" },
    ],
    state: {
      ...state,
      history: {
        back: [...state.history.back, state.path],
        forward: state.history.forward.slice(1),
      },
      path,
      query: { ...state.query, search: "" },
      selectionPath: null,
    },
  }
}

function reduceQueryChanged(
  state: FileSystemKernelState,
  query: FileSystemQueryState,
  source: FileSystemEventSource
): FileSystemKernelResult {
  const nextSelectionPath = selectionMatchesQuery(state, query)
    ? state.selectionPath
    : null
  const commands: FileSystemKernelCommand[] = []

  if (source === "user") commands.push({ query, type: "callback.queryChanged" })
  if (nextSelectionPath !== state.selectionPath) {
    commands.push({ entry: null, type: "callback.selectionChanged" })
  }

  return {
    commands,
    state: { ...state, query, selectionPath: nextSelectionPath },
  }
}

function reduceViewChanged(
  state: FileSystemKernelState,
  view: FileSystemView,
  source: FileSystemEventSource
): FileSystemKernelResult {
  if (view === state.view) return unchanged(state)

  return {
    commands: source === "user" ? [{ type: "callback.viewChanged", view }] : [],
    state: { ...state, view },
  }
}

function reduceEntrySelected(
  state: FileSystemKernelState,
  path: string | null,
  source: FileSystemEventSource
): FileSystemKernelResult {
  const selectionPath = normalizeSelectionPath(state.tree, path)
  if (selectionPath === state.selectionPath) return unchanged(state)

  return {
    commands:
      source === "user"
        ? [
            {
              entry: selectionPath
                ? (state.tree.entriesByPath.get(selectionPath) ?? null)
                : null,
              type: "callback.selectionChanged",
            },
          ]
        : [],
    state: { ...state, selectionPath },
  }
}

function reduceEntryOpenRequested(
  state: FileSystemKernelState,
  path: string
): FileSystemKernelResult {
  const entry = state.tree.entriesByPath.get(normalizeFileSystemEntryPath(path) ?? "")

  if (!entry || entry.kind !== "file") return unchanged(state)
  return { commands: [{ file: entry, type: "file.open" }], state }
}

function reduceFolderLoadRequested(
  state: FileSystemKernelState,
  event: Extract<FileSystemKernelEvent, { type: "folder.loadRequested" }>
): FileSystemKernelResult {
  const path = normalizeFolderPath(event.path)

  return {
    commands: [
      {
        path,
        reason: event.reason,
        requestId: event.requestId,
        type: "folder.ensure",
      },
    ],
    state: {
      ...state,
      folders: new Map(state.folders).set(path, {
        reason: event.reason,
        requestId: event.requestId,
        status: "loading",
      }),
    },
  }
}

function reduceFolderLoadSucceeded(
  state: FileSystemKernelState,
  event: Extract<FileSystemKernelEvent, { type: "folder.loadSucceeded" }>
): FileSystemKernelResult {
  const path = normalizeFolderPath(event.path)
  const current = state.folders.get(path)

  if (
    current?.status !== "loading" ||
    current.requestId !== event.requestId
  ) {
    return unchanged(state)
  }

  const folders = new Map(state.folders)
  folders.set(path, { status: "loaded" })
  const tree = mergeFileSystemTreeItems({ items: event.items, tree: state.tree })

  return {
    commands: [],
    state: {
      ...state,
      folders,
      selectionPath: normalizeSelectionPath(tree, state.selectionPath),
      tree,
    },
  }
}

function reduceFolderLoadFailed(
  state: FileSystemKernelState,
  event: Extract<FileSystemKernelEvent, { type: "folder.loadFailed" }>
): FileSystemKernelResult {
  const path = normalizeFolderPath(event.path)
  const current = state.folders.get(path)

  if (
    current?.status !== "loading" ||
    current.requestId !== event.requestId
  ) {
    return unchanged(state)
  }

  return {
    commands: [],
    state: {
      ...state,
      folders: new Map(state.folders).set(path, {
        error: event.error,
        status: "failed",
      }),
    },
  }
}

function unchanged(state: FileSystemKernelState): FileSystemKernelResult {
  return { commands: [], state }
}

function isKnownFolderPath(tree: FileSystemTreeState, path: string) {
  return path === "" || tree.entriesByPath.get(path)?.kind === "folder"
}

function normalizeSelectionPath(
  tree: FileSystemTreeState,
  path: string | null | undefined
) {
  const entryPath = normalizeFileSystemEntryPath(path)

  return entryPath && tree.entriesByPath.has(entryPath) ? entryPath : null
}

function selectionMatchesQuery(
  state: FileSystemKernelState,
  query: FileSystemQueryState
) {
  if (!state.selectionPath || !query.search) return true

  const rawIndex = fileSystemTreeToIndex(state.tree)
  const visibleIndex = buildVisibleIndex(rawIndex, state.path, query)

  return (
    visibleIndex.files.has(state.selectionPath) ||
    visibleIndex.folders.has(normalizeFolderPath(state.selectionPath))
  )
}

function buildVisibleIndex(
  index: FileSystemIndex,
  path: string,
  query: FileSystemQueryState
) {
  return deriveVisibleIndex(index, path, query)
}

function nextSort(query: FileSystemQueryState, key: FileSystemSortKey) {
  const defaultSort = DEFAULT_FILE_SYSTEM_QUERY.sort

  if (query.sort.key === key) {
    return {
      direction: query.sort.direction === "asc" ? "desc" : "asc",
      key,
    } satisfies FileSystemQueryState["sort"]
  }

  return {
    direction:
      key === defaultSort.key || key === "kind" ? defaultSort.direction : "desc",
    key,
  } satisfies FileSystemQueryState["sort"]
}
