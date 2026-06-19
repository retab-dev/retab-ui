"use client";

import * as React from "react";
import {
  type FileTreeDirectoryHandle,
  type FileTreeItemHandle,
  type FileTree as PierreFileTreeModel,
} from "@pierre/trees";

import type { FileSystemPierreLoadingController } from "./file-system-pierre-adapter";
import type { PierrePath } from "./file-system-pierre-input";
import type { FileSystemEntry } from "./file-system-types";

const useIsoLayoutEffect =
  typeof window === "undefined" ? React.useEffect : React.useLayoutEffect;

export type FileSystemPierreLazyRetrySelection = {
  entry: FileSystemEntry | null;
  pierrePath: PierrePath | null | undefined;
};

export type FileSystemPierreLazyRetryCommand = {
  entryPath: string;
  kind: "retry-and-expand";
  pierrePath: PierrePath;
};

export type FileSystemPierreLazyLoadCommand = {
  entryPath: string;
  kind: "load";
};

export type FileSystemPierreLazyFolderCommand =
  | FileSystemPierreLazyLoadCommand
  | FileSystemPierreLazyRetryCommand;

export function createFileSystemPierreLazyFolderCommand({
  folderErrors,
  selection,
}: {
  folderErrors: ReadonlyMap<string, string>;
  selection: FileSystemPierreLazyRetrySelection | null;
}): FileSystemPierreLazyFolderCommand | null {
  if (selection?.entry?.kind !== "folder" || !selection.pierrePath) {
    return null;
  }

  if (folderErrors.has(selection.entry.path)) {
    return {
      entryPath: selection.entry.path,
      kind: "retry-and-expand",
      pierrePath: selection.pierrePath,
    };
  }

  return {
    entryPath: selection.entry.path,
    kind: "load",
  };
}

export function createFileSystemPierreLazyRetryCommand({
  folderErrors,
  selection,
}: {
  folderErrors: ReadonlyMap<string, string>;
  selection: FileSystemPierreLazyRetrySelection | null;
}): FileSystemPierreLazyRetryCommand | null {
  if (
    selection?.entry?.kind !== "folder" ||
    !selection.pierrePath ||
    !folderErrors.has(selection.entry.path)
  ) {
    return null;
  }

  return {
    entryPath: selection.entry.path,
    kind: "retry-and-expand",
    pierrePath: selection.pierrePath,
  };
}

export function useFileSystemPierreLazyRetryExpansion({
  loading,
  modelRef,
}: {
  loading: FileSystemPierreLoadingController;
  modelRef: React.MutableRefObject<PierreFileTreeModel | null>;
}) {
  const loadingRef = React.useRef(loading);

  useIsoLayoutEffect(() => {
    loadingRef.current = loading;
  }, [loading]);

  return React.useCallback(
    (command: FileSystemPierreLazyFolderCommand | null) => {
      if (!command) {
        return;
      }

      const currentLoading = loadingRef.current;
      if (command.kind === "load") {
        void currentLoading.ensureChildren(command.entryPath);
        return;
      }

      if (!currentLoading.folderErrors.has(command.entryPath)) {
        return;
      }

      const childrenPromise = currentLoading.ensureChildren(command.entryPath, {
        retry: true,
      });

      void childrenPromise.then((children) => {
        if (children.length === 0) {
          return;
        }

        expandPierreDirectory(modelRef.current, command.pierrePath);

        window.setTimeout(() => {
          expandPierreDirectory(modelRef.current, command.pierrePath);
        }, 0);
      });
    },
    [modelRef],
  );
}

function expandPierreDirectory(
  model: PierreFileTreeModel | null,
  pierrePath: PierrePath,
) {
  const item = model?.getItem(pierrePath) ?? null;

  if (isDirectoryItem(item)) {
    item.expand();
  }
}

function isDirectoryItem(
  item: FileTreeItemHandle | null,
): item is FileTreeDirectoryHandle {
  return item?.isDirectory() === true;
}
