"use client"

import * as React from "react"
import type { FileTree as PierreFileTreeModel } from "@pierre/trees"

import type { FileSystemPierreLoadingController } from "./file-system-pierre-adapter"
import {
  rememberFileSystemPierreExpansionSnapshot,
  resolveFileSystemPierreExpansionAfterReset,
  type FileSystemPierreExpansionSnapshot,
} from "./file-system-pierre-expansion-snapshot"
import type { PierrePath } from "./file-system-pierre-input"
import {
  useFileSystemPierreLazyRetryExpansion,
  type FileSystemPierreLazyFolderCommand,
} from "./file-system-pierre-lazy-retry"
import type {
  FileSystemPierreResetIdentity,
  FileSystemPierreResetTransition,
} from "./file-system-pierre-reset-identity"
import {
  createFileSystemPierreResetPlan,
  type FileSystemPierreResetPlan,
} from "./file-system-pierre-reset-plan"

const useIsoLayoutEffect =
  typeof window === "undefined" ? React.useEffect : React.useLayoutEffect

export type FileSystemPierreExpansion = {
  createResetPlan: (
    transition: FileSystemPierreResetTransition
  ) => FileSystemPierreResetPlan
  runLazyFolderCommand: (
    command: FileSystemPierreLazyFolderCommand | null
  ) => void
  modelRef: React.MutableRefObject<PierreFileTreeModel | null>
  rememberBeforeReset: (identity: FileSystemPierreResetIdentity) => void
  resolveAfterReset: (identity: FileSystemPierreResetIdentity) => PierrePath[]
}

export function useFileSystemPierreExpansion({
  loading,
}: {
  loading: FileSystemPierreLoadingController
}): FileSystemPierreExpansion {
  const modelRef = React.useRef<PierreFileTreeModel | null>(null)
  const snapshotsByCurrentPathRef = React.useRef(
    new Map<string, FileSystemPierreExpansionSnapshot>()
  )
  const runLazyFolderCommand = useFileSystemPierreLazyRetryExpansion({
    loading,
    modelRef,
  })
  const createResetPlan = React.useCallback(
    (transition: FileSystemPierreResetTransition) =>
      createFileSystemPierreResetPlan({
        snapshotsByCurrentPath: snapshotsByCurrentPathRef.current,
        transition,
      }),
    []
  )
  const rememberBeforeReset = React.useCallback(
    (identity: FileSystemPierreResetIdentity) => {
      const model = modelRef.current

      if (!model) {
        return
      }

      rememberFileSystemPierreExpansionSnapshot({
        identity,
        model,
        snapshotsByCurrentPath: snapshotsByCurrentPathRef.current,
      })
    },
    []
  )
  const resolveAfterReset = React.useCallback(
    (identity: FileSystemPierreResetIdentity) =>
      resolveFileSystemPierreExpansionAfterReset({
        identity,
        snapshotsByCurrentPath: snapshotsByCurrentPathRef.current,
      }),
    []
  )

  return React.useMemo(
    () => ({
      createResetPlan,
      modelRef,
      rememberBeforeReset,
      resolveAfterReset,
      runLazyFolderCommand,
    }),
    [
      createResetPlan,
      rememberBeforeReset,
      resolveAfterReset,
      runLazyFolderCommand,
    ]
  )
}

export function useBindFileSystemPierreExpansionModel({
  expansion,
  model,
}: {
  expansion: FileSystemPierreExpansion
  model: PierreFileTreeModel
}) {
  useIsoLayoutEffect(() => {
    expansion.modelRef.current = model
    return () => {
      if (expansion.modelRef.current === model) {
        expansion.modelRef.current = null
      }
    }
  }, [expansion, model])
}
