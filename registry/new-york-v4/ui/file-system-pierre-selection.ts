"use client";

import * as React from "react";
import type { FileTree as PierreFileTreeModel } from "@pierre/trees";

import type { FileSystemPierreSelectionController } from "./file-system-pierre-adapter";
import {
  pierrePathToFileSystemEntry,
  type FileSystemPierreInput,
  type PierrePath,
} from "./file-system-pierre-input";
import type { FileSystemEntry } from "./file-system-types";

const useIsoLayoutEffect =
  typeof window === "undefined" ? React.useEffect : React.useLayoutEffect;

export type FileSystemPierreSelectionState = {
  input: FileSystemPierreInput;
  selection: FileSystemPierreSelectionController;
};

export type FileSystemPierreSelectedEntry = {
  entry: FileSystemEntry;
  pierrePath: PierrePath;
};

export function useLatestFileSystemPierreSelectionState(
  state: FileSystemPierreSelectionState,
) {
  const stateRef = React.useRef(state);

  useIsoLayoutEffect(() => {
    stateRef.current = state;
  });

  return React.useCallback(() => stateRef.current, []);
}

export function useFileSystemPierreSelectionHandler(
  getLatestState: () => FileSystemPierreSelectionState,
) {
  return React.useCallback(
    ([pierrePath]: readonly string[]): FileSystemPierreSelectedEntry | null => {
      const { input, selection } = getLatestState();
      const entry = pierrePathToFileSystemEntry(pierrePath, input);

      if (!entry || !pierrePath) {
        return null;
      }

      selection.selectEntry(entry);

      return {
        entry,
        pierrePath: selectedPathToPierrePath(entry.path, input) ?? pierrePath,
      };
    },
    [getLatestState],
  );
}

export function useSyncFileSystemPierreSelection({
  input,
  model,
  selection,
}: FileSystemPierreSelectionState & {
  model: PierreFileTreeModel;
}) {
  useIsoLayoutEffect(() => {
    const selectedPierrePath = selectedPathToPierrePath(
      selection.selectedPath,
      input,
    );

    if (!selectedPierrePath) {
      return;
    }

    const item = model.getItem(selectedPierrePath);

    if (!item || item.isSelected()) {
      return;
    }

    item.select();
    model.scrollToPath(selectedPierrePath);
  }, [input, model, selection.selectedPath]);
}

export function scrollCurrentFileSystemEntryIntoView({
  input,
  model,
  selectedPath,
}: {
  input: FileSystemPierreInput;
  model: PierreFileTreeModel;
  selectedPath: string | null;
}) {
  const selectedPierrePath = selectedPathToPierrePath(selectedPath, input);

  if (!selectedPierrePath) {
    return;
  }

  model.getItem(selectedPierrePath)?.select();
  model.scrollToPath(selectedPierrePath);
}

export function selectedPathToPierrePath(
  selectedPath: string | null,
  input: FileSystemPierreInput,
): PierrePath | null {
  if (!selectedPath) {
    return null;
  }

  for (const [pierrePath, entry] of input.entriesByPierrePath.entries()) {
    if (entry.path === selectedPath) {
      return pierrePath;
    }
  }

  return null;
}
