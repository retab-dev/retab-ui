"use client";

import * as React from "react";
import { FileTree as PierreFileTree } from "@pierre/trees/react";

import {
  createFileSystemPierreAdapterState,
  type FileSystemPierreAdapterSource,
} from "./file-system-pierre-adapter";
import { useFileSystemPierreDecorationVersion } from "./file-system-pierre-decoration-version";
import {
  buildFileSystemPierreInput,
  pierrePathToFileSystemEntry,
  type FileSystemPierreInput,
} from "./file-system-pierre-input";
import { useFileSystemListContinuity } from "./file-system-list-continuity";
import { useFileSystemPierreModel } from "./file-system-pierre-model";
import type { FileSystemFileEntry } from "./file-system-types";

export type FileSystemListTreeProps = FileSystemPierreAdapterSource & {
  onOpenFile: (file: FileSystemFileEntry) => void;
};

export function FileSystemListTree({
  onOpenFile,
  ...source
}: FileSystemListTreeProps) {
  const listContinuity = useFileSystemListContinuity<FileSystemPierreInput>({
    currentPath: source.currentPath,
    search: source.search,
    selectedPath: source.selectedPath,
  });
  const input = React.useMemo(
    () =>
      buildFileSystemPierreInput({
        currentPath: source.currentPath,
        index: source.index,
      }),
    [source.currentPath, source.index],
  );
  const pierre = React.useMemo(
    () => createFileSystemPierreAdapterState(source),
    [source],
  );
  const decorationVersion = useFileSystemPierreDecorationVersion({
    folderErrors: pierre.decoration.folderErrors,
    loadingFolders: pierre.decoration.loadingFolders,
  });
  const { model } = useFileSystemPierreModel({
    decoration: pierre.decoration,
    decorationVersion,
    input,
    listContinuity,
    loading: pierre.loading,
    navigation: pierre.navigation,
    query: pierre.query,
    selection: pierre.selection,
  });

  const openPierrePath = React.useCallback(
    (path: string | null) => {
      const entry = pierrePathToFileSystemEntry(path, input);

      if (!entry) return;

      if (entry.kind === "folder") {
        if (source.folderErrors.has(entry.path)) {
          void source.ensureChildren(entry.path, { retry: true });
        }
        source.navigateTo(entry.path);
        return;
      }

      onOpenFile(entry);
    },
    [input, onOpenFile, source],
  );

  const handleDoubleClick = React.useCallback(
    (event: React.MouseEvent<HTMLElement>) => {
      openPierrePath(pierrePathFromEvent(event));
    },
    [openPierrePath],
  );

  const handleKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLElement>) => {
      if (event.key !== "Enter") return;

      openPierrePath(
        model.getFocusedPath() ?? model.getSelectedPaths().at(-1) ?? null,
      );
      event.preventDefault();
    },
    [model, openPierrePath],
  );

  return (
    <PierreFileTree
      aria-label="Files"
      className="block size-full min-h-0"
      data-slot="file-system-pierre-tree"
      data-list-continuity-revision={listContinuity.state.modelRevision}
      model={model}
      onDoubleClick={handleDoubleClick}
      onKeyDown={handleKeyDown}
    />
  );
}

function pierrePathFromEvent(event: React.SyntheticEvent<HTMLElement>) {
  for (const target of event.nativeEvent.composedPath()) {
    if (
      target instanceof HTMLElement &&
      target.dataset.type === "item" &&
      target.dataset.itemPath
    ) {
      return target.dataset.itemPath;
    }
  }

  const target = event.target;

  if (!(target instanceof HTMLElement)) return null;

  return target.closest<HTMLElement>("[data-path]")?.dataset.path ?? null;
}
