"use client";

import * as React from "react";
import type { FileTree as PierreFileTreeModel } from "@pierre/trees";

import type { FileSystemListContinuity } from "./file-system-list-continuity";
import type { FileSystemPierreExpansion } from "./file-system-pierre-expansion";
import type { FileSystemPierreInput } from "./file-system-pierre-input";
import type { FileSystemPierreOrder } from "./file-system-pierre-order";
import { createFileSystemListContinuityIdentity } from "./file-system-list-continuity";

const useIsoLayoutEffect =
  typeof window === "undefined" ? React.useEffect : React.useLayoutEffect;

export function useResetFileSystemPierreModel({
  currentPath,
  decorationVersion,
  expansion,
  hasSemanticQuery,
  input,
  listContinuity,
  model,
  order,
  selectedPath,
}: {
  currentPath: string;
  decorationVersion: string;
  expansion: FileSystemPierreExpansion;
  hasSemanticQuery: boolean;
  input: FileSystemPierreInput;
  listContinuity: FileSystemListContinuity<FileSystemPierreInput>;
  model: PierreFileTreeModel;
  order: FileSystemPierreOrder;
  selectedPath: string | null;
}) {
  useIsoLayoutEffect(() => {
    const identity = createFileSystemPierreListContinuityIdentity({
      currentPath,
      decorationVersion,
      hasSemanticQuery,
      input,
    });
    const commands = listContinuity.dispatch({
      identity,
      type: "identity.requested",
    });

    for (const command of commands) {
      expansion.runListContinuityCommand({
        command,
        listContinuity,
        model,
        order,
        selectedPath,
      });
    }
  }, [
    currentPath,
    decorationVersion,
    expansion,
    hasSemanticQuery,
    input,
    listContinuity,
    model,
    order,
    selectedPath,
  ]);
}

function createFileSystemPierreListContinuityIdentity({
  currentPath,
  decorationVersion,
  hasSemanticQuery,
  input,
}: {
  currentPath: string;
  decorationVersion: string;
  hasSemanticQuery: boolean;
  input: FileSystemPierreInput;
}) {
  return createFileSystemListContinuityIdentity({
    currentPath,
    decorationVersion,
    hasSemanticQuery,
    input: {
      itemPaths: input.pierrePaths,
      runtimeInput: input,
    },
  });
}
