"use client";

import * as React from "react";

import { useFileSystemKernelRuntime } from "./file-system-kernel-runtime";
import {
  selectFileSystemBrowserState,
  selectFileSystemSelectionState,
} from "./file-system-kernel-selectors";
import {
  useFileSystemOpenPreviewController,
  type FileSystemOpenPreviewController,
} from "./file-system-open-preview-state";
import { useFileSystemSourceController } from "./file-system-source-controller";
import type { FileSystemProps } from "./file-system-types";

export type FileSystemProviderProps = Omit<FileSystemProps, "className"> & {
  children: React.ReactNode;
};

export type FileSystemRenderers = {
  renderFileActions?: FileSystemProps["renderFileActions"];
  renderMetadata?: FileSystemProps["renderMetadata"];
};

export type FileSystemCompositionState = {
  openPreview: FileSystemOpenPreviewController;
  renderers: FileSystemRenderers;
  title: string;
};

export type FileSystemContextValue = {
  browser: ReturnType<typeof selectFileSystemBrowserState>;
  selection: ReturnType<typeof selectFileSystemSelectionState>;
} & FileSystemCompositionState;

const FileSystemContext = React.createContext<FileSystemContextValue | null>(
  null,
);

export function useFileSystem() {
  const context = React.useContext(FileSystemContext);
  if (!context) {
    throw new Error("useFileSystem must be used within FileSystemProvider.");
  }
  return context;
}

export function FileSystemProvider({
  items,
  children,
  defaultPath,
  defaultQuery,
  defaultSelectedPath,
  defaultView = "list",
  loadChildren,
  onPathChange,
  onQueryChange,
  onFileOpen,
  onSelectionChange,
  onViewChange,
  path,
  query,
  renderFileActions,
  renderMetadata,
  resolveSource,
  selectedPath,
  title = "Files",
  view,
}: FileSystemProviderProps) {
  const source = useFileSystemSourceController({ items, resolveSource });
  const openPreview = useFileSystemOpenPreviewController({
    onFileOpen,
    resolveFileSource: source.resolveFileSource,
  });
  const kernel = useFileSystemKernelRuntime({
    defaultPath,
    defaultQuery,
    defaultSelectedPath,
    defaultView,
    items,
    loadChildren,
    onFileCommand: openPreview.open,
    onPathChange,
    onQueryChange,
    onSelectionChange,
    onViewChange,
    path,
    query,
    selectedPath,
    view,
  });
  const browser = React.useMemo(
    () =>
      selectFileSystemBrowserState({
        dispatch: kernel.dispatch,
        ensureChildren: kernel.ensureChildren,
        getState: kernel.getState,
        state: kernel.state,
      }),
    [kernel.dispatch, kernel.ensureChildren, kernel.getState, kernel.state],
  );
  const selection = React.useMemo(
    () =>
      selectFileSystemSelectionState({
        resolveSource: source.resolveFileSource,
        state: kernel.state,
      }),
    [kernel.state, source.resolveFileSource],
  );
  const renderers = React.useMemo<FileSystemRenderers>(
    () => ({ renderFileActions, renderMetadata }),
    [renderFileActions, renderMetadata],
  );
  const value = React.useMemo<FileSystemContextValue>(
    () => ({
      browser,
      selection,
      openPreview,
      renderers,
      title,
    }),
    [browser, openPreview, renderers, selection, title],
  );

  return (
    <FileSystemContext.Provider value={value}>
      {children}
    </FileSystemContext.Provider>
  );
}
