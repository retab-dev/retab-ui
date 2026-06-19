"use client";

import * as React from "react";
import type {
  FileTreeDirectoryHandle,
  FileTreeItemHandle,
  FileTree as PierreFileTreeModel,
} from "@pierre/trees";

import {
  type FileSystemListContinuity,
  type FileSystemListContinuityCommand,
} from "./file-system-list-continuity";
import type { FileSystemPierreLoadingController } from "./file-system-pierre-adapter";
import type {
  FileSystemPierreInput,
  PierrePath,
} from "./file-system-pierre-input";
import {
  useFileSystemPierreLazyRetryExpansion,
  type FileSystemPierreLazyFolderCommand,
} from "./file-system-pierre-lazy-retry";
import type { FileSystemPierreOrder } from "./file-system-pierre-order";
import { scrollCurrentFileSystemEntryIntoView } from "./file-system-pierre-selection";
import { useKeyedLayoutEffect } from "@/hooks/use-keyed-layout-effect";
import { joinEffectKey } from "@/lib/effect-key";

export type FileSystemPierreExpansion = {
  collectExpandedItemPaths: (itemPaths: readonly PierrePath[]) => PierrePath[];
  runListContinuityCommand: ({
    command,
    listContinuity,
    model,
    order,
    selectedPath,
  }: {
    command: FileSystemListContinuityCommand<FileSystemPierreInput>;
    listContinuity: FileSystemListContinuity<FileSystemPierreInput>;
    model: PierreFileTreeModel;
    order: FileSystemPierreOrder;
    selectedPath: string | null;
  }) => void;
  runLazyFolderCommand: (
    command: FileSystemPierreLazyFolderCommand | null,
  ) => void;
  modelRef: React.MutableRefObject<PierreFileTreeModel | null>;
};

export function useFileSystemPierreExpansion({
  loading,
}: {
  loading: FileSystemPierreLoadingController;
}): FileSystemPierreExpansion {
  const modelRef = React.useRef<PierreFileTreeModel | null>(null);
  const runLazyFolderCommand = useFileSystemPierreLazyRetryExpansion({
    loading,
    modelRef,
  });
  const collectExpandedItemPaths = React.useCallback(
    (itemPaths: readonly PierrePath[]) => {
      const model = modelRef.current;

      return model ? collectOpenPierrePaths(model, itemPaths) : [];
    },
    [],
  );
  const runListContinuityCommand = React.useCallback(
    ({
      command,
      listContinuity,
      model,
      order,
      selectedPath,
    }: {
      command: FileSystemListContinuityCommand<FileSystemPierreInput>;
      listContinuity: FileSystemListContinuity<FileSystemPierreInput>;
      model: PierreFileTreeModel;
      order: FileSystemPierreOrder;
      selectedPath: string | null;
    }) => {
      if (command.type === "snapshot.capture") {
        runFileSystemPierreListContinuityCommands({
          commands: listContinuity.dispatch({
            expandedPaths: collectOpenPierrePaths(
              model,
              command.identity.input.itemPaths,
            ),
            identity: command.identity,
            type: "snapshot.captured",
          }),
          listContinuity,
          model,
          order,
          runListContinuityCommand,
          selectedPath,
        });
        return;
      }

      if (command.type === "model.apply") {
        order.reset(command.nextItemPaths);
        model.resetPaths(command.nextItemPaths, {
          initialExpandedPaths: command.expandedPaths,
          preparedInput: command.identity.input.runtimeInput.preparedInput,
        });
        runFileSystemPierreListContinuityCommands({
          commands: listContinuity.dispatch({
            expandedPaths: collectOpenPierrePaths(
              model,
              command.identity.input.itemPaths,
            ),
            identity: command.identity,
            type: "model.applied",
          }),
          listContinuity,
          model,
          order,
          runListContinuityCommand,
          selectedPath,
        });
        return;
      }

      const input = listContinuity.state.identity?.input.runtimeInput;

      if (input) {
        scrollCurrentFileSystemEntryIntoView({
          input,
          model,
          selectedPath: command.path,
        });
      }
      runFileSystemPierreListContinuityCommands({
        commands: listContinuity.dispatch({ type: "selection.revealed" }),
        listContinuity,
        model,
        order,
        runListContinuityCommand,
        selectedPath,
      });
    },
    [],
  );

  return React.useMemo(
    () => ({
      collectExpandedItemPaths,
      modelRef,
      runListContinuityCommand,
      runLazyFolderCommand,
    }),
    [collectExpandedItemPaths, runListContinuityCommand, runLazyFolderCommand],
  );
}

export function runFileSystemPierreListContinuityCommands({
  commands,
  listContinuity,
  model,
  order,
  runListContinuityCommand,
  selectedPath,
}: {
  commands: FileSystemListContinuityCommand<FileSystemPierreInput>[];
  listContinuity: FileSystemListContinuity<FileSystemPierreInput>;
  model: PierreFileTreeModel;
  order: FileSystemPierreOrder;
  runListContinuityCommand: FileSystemPierreExpansion["runListContinuityCommand"];
  selectedPath: string | null;
}) {
  for (const command of commands) {
    runListContinuityCommand({
      command,
      listContinuity,
      model,
      order,
      selectedPath,
    });
  }
}

function collectOpenPierrePaths(
  model: PierreFileTreeModel,
  pierrePaths: readonly string[],
): PierrePath[] {
  const openPaths: PierrePath[] = [];

  for (const path of pierrePaths) {
    const item = model.getItem(path);

    if (isDirectoryItem(item) && item.isExpanded()) {
      openPaths.push(path);
    }
  }

  return openPaths;
}

function isDirectoryItem(
  item: FileTreeItemHandle | null,
): item is FileTreeDirectoryHandle {
  return item?.isDirectory() === true;
}

export function useBindFileSystemPierreExpansionModel({
  expansion,
  model,
}: {
  expansion: FileSystemPierreExpansion;
  model: PierreFileTreeModel;
}) {
  useKeyedLayoutEffect(joinEffectKey([expansion, model]), () => {
    expansion.modelRef.current = model;
    return () => {
      if (expansion.modelRef.current === model) {
        expansion.modelRef.current = null;
      }
    };
  });
}
