"use client";

import type {
  FileSystemBrowserState,
  FileSystemHeaderState,
  FileSystemSelectionState,
} from "./file-system-browser-state";
import { normalizeFolderPath } from "./file-system-index";
import {
  fileSystemTreeToIndex,
  normalizeFileSystemEntryPath,
  type FileSystemKernelEvent,
  type FileSystemKernelState,
} from "./file-system-kernel";
import { deriveVisibleIndex } from "./file-system-query";
import type { FileSystemSourceController } from "./file-system-source-controller";
import type {
  FileSystemEntry,
  FileSystemFileEntry,
  FileSystemIndex,
  FileSystemView,
} from "./file-system-types";

const rawIndexCache = new WeakMap<
  FileSystemKernelState["tree"],
  FileSystemIndex
>();
const visibleIndexCache = new WeakMap<
  FileSystemKernelState["tree"],
  Map<string, WeakMap<FileSystemKernelState["query"], FileSystemIndex>>
>();

export type FileSystemDispatch = (event: FileSystemKernelEvent) => void;

export type FileSystemEnsureChildren = (
  path: string,
  options?: { retry?: boolean },
) => Promise<FileSystemEntry[]>;

export type FileSystemKernelSelectors = {
  index: FileSystemIndex;
  rawIndex: FileSystemIndex;
  selectedEntry: FileSystemEntry | null;
  visibleEntries: FileSystemEntry[];
};

export function selectFileSystemKernel({
  state,
}: {
  state: FileSystemKernelState;
}): FileSystemKernelSelectors {
  const rawIndex = selectRawIndex(state);
  const index = selectVisibleIndex(state, rawIndex);

  return {
    index,
    rawIndex,
    selectedEntry: selectSelectedEntry(state),
    visibleEntries: index.children.get(state.path) ?? [],
  };
}

function selectRawIndex(state: FileSystemKernelState) {
  const cached = rawIndexCache.get(state.tree);
  if (cached) return cached;

  const index = fileSystemTreeToIndex(state.tree);

  rawIndexCache.set(state.tree, index);
  return index;
}

function selectVisibleIndex(
  state: FileSystemKernelState,
  rawIndex: FileSystemIndex,
) {
  let pathCache = visibleIndexCache.get(state.tree);

  if (!pathCache) {
    pathCache = new Map();
    visibleIndexCache.set(state.tree, pathCache);
  }

  let queryCache = pathCache.get(state.path);

  if (!queryCache) {
    queryCache = new WeakMap();
    pathCache.set(state.path, queryCache);
  }

  const cached = queryCache.get(state.query);
  if (cached) return cached;

  const index = deriveVisibleIndex(rawIndex, state.path, state.query);

  queryCache.set(state.query, index);
  return index;
}

export function selectSelectedEntry(state: FileSystemKernelState) {
  if (!state.selectionPath) return null;

  return state.tree.entriesByPath.get(state.selectionPath) ?? null;
}

export function selectFileSystemBrowserState({
  dispatch,
  ensureChildren,
  getState,
  state,
}: {
  dispatch: FileSystemDispatch;
  ensureChildren: FileSystemEnsureChildren;
  getState: () => FileSystemKernelState;
  state: FileSystemKernelState;
}): FileSystemBrowserState {
  const selectors = selectFileSystemKernel({ state });

  return {
    canGoBack: state.history.back.length > 0,
    canGoForward: state.history.forward.length > 0,
    currentPath: state.path,
    entries: selectors.visibleEntries,
    ensureChildren,
    folderErrors: selectFolderErrors(state),
    goBack: () => dispatch({ type: "history.back" }),
    goForward: () => dispatch({ type: "history.forward" }),
    index: selectors.index,
    loadingFolders: selectLoadingFolders(state),
    navigateTo: (path) =>
      dispatch({ path, source: "user", type: "path.changed" }),
    query: state.query,
    rawIndex: selectors.rawIndex,
    selectEntry: (entry) =>
      dispatch({
        path: entry?.path ?? null,
        source: "user",
        type: "entry.selected",
      }),
    selectedEntry: selectors.selectedEntry,
    selectedPath: state.selectionPath,
    selectFirstChildAfterEnsure: async (path) => {
      const folderPath = normalizeFolderPath(path);
      const requestedCurrentPath = state.path;
      const children = await ensureChildren(path);
      const entry = children[0] ?? null;
      const latestState = getState();

      if (latestState.selectionPath !== folderPath) return null;
      if (latestState.path !== requestedCurrentPath) return null;

      if (entry) {
        dispatch({ path: entry.path, source: "user", type: "entry.selected" });
      }

      return entry;
    },
    setSearch: (search) => dispatch({ search, type: "query.searchChanged" }),
    setSortKey: (key) => dispatch({ key, type: "query.sortKeyChanged" }),
    setView: (view: FileSystemView) =>
      dispatch({ source: "user", type: "view.changed", view }),
    view: state.view,
  };
}

export function selectFileSystemHeaderState({
  browser,
  title,
}: {
  browser: FileSystemBrowserState;
  title: string;
}): FileSystemHeaderState {
  return {
    canGoBack: browser.canGoBack,
    canGoForward: browser.canGoForward,
    currentPath: browser.currentPath,
    goBack: browser.goBack,
    goForward: browser.goForward,
    query: browser.query,
    setSearch: browser.setSearch,
    setSortKey: browser.setSortKey,
    setView: browser.setView,
    title,
    view: browser.view,
  };
}

export function selectFileSystemSelectionState({
  resolveSource,
  state,
}: {
  resolveSource: FileSystemSourceController["resolveFileSource"];
  state: FileSystemKernelState;
}): FileSystemSelectionState {
  return {
    entry: selectSelectedEntry(state),
    resolveSource,
  };
}

export function selectFileSystemListInput({
  state,
}: {
  state: FileSystemKernelState;
}) {
  const selectors = selectFileSystemKernel({ state });

  return {
    currentPath: state.path,
    folderErrors: selectFolderErrors(state),
    index: selectors.index,
    loadingFolders: selectLoadingFolders(state),
    search: state.query.search,
    selectedPath: state.selectionPath,
  };
}

export function selectFolderErrors(state: FileSystemKernelState) {
  const errors = new Map<string, string>();

  for (const [path, folder] of state.folders) {
    if (folder.status === "failed") errors.set(path, folder.error);
  }

  return errors;
}

export function selectLoadingFolders(state: FileSystemKernelState) {
  const folders = new Set<string>();

  for (const [path, folder] of state.folders) {
    if (folder.status === "loading") folders.add(path);
  }

  return folders;
}

export function selectFileEntry(
  state: FileSystemKernelState,
  path: string,
): FileSystemFileEntry | null {
  const entryPath = normalizeFileSystemEntryPath(path);
  const entry = entryPath ? state.tree.entriesByPath.get(entryPath) : null;

  return entry?.kind === "file" ? entry : null;
}
