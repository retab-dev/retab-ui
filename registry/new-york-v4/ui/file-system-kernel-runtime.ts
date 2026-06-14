"use client"

import * as React from "react"

import { useFileSystemControlledProps } from "./file-system-controlled-props"
import { useFileSystemFolderTask } from "./file-system-folder-task"
import {
  createFileSystemKernelState,
  reduceFileSystemKernel,
  type FileSystemKernelCommand,
  type FileSystemKernelEvent,
  type FileSystemKernelResult,
  type FileSystemKernelState,
} from "./file-system-kernel"
import { useFileSystemKernelCommandEffects } from "./file-system-kernel-command-effects"
import type {
  FileSystemDispatch,
  FileSystemEnsureChildren,
} from "./file-system-kernel-selectors"
import type { FileSystemFileEntry, FileSystemProps } from "./file-system-types"

type FileSystemKernelRuntimeStore = {
  consumeCommands: () => FileSystemKernelCommand[]
  dispatch: (event: FileSystemKernelEvent) => FileSystemKernelResult
  getState: () => FileSystemKernelState
  subscribe: (listener: () => void) => () => void
}

export type FileSystemKernelRuntime = {
  dispatch: FileSystemDispatch
  ensureChildren: FileSystemEnsureChildren
  getState: () => FileSystemKernelState
  state: FileSystemKernelState
}

export function useFileSystemKernelRuntime({
  defaultPath,
  defaultQuery,
  defaultSelectedPath,
  defaultView = "list",
  items,
  loadChildren,
  onFileCommand,
  onPathChange,
  onQueryChange,
  onSelectionChange,
  onViewChange,
  path,
  query,
  selectedPath,
  view,
}: Pick<
  FileSystemProps,
  | "defaultPath"
  | "defaultQuery"
  | "defaultSelectedPath"
  | "defaultView"
  | "items"
  | "loadChildren"
  | "onPathChange"
  | "onQueryChange"
  | "onSelectionChange"
  | "onViewChange"
  | "path"
  | "query"
  | "selectedPath"
  | "view"
> & {
  onFileCommand: (file: FileSystemFileEntry) => void
}): FileSystemKernelRuntime {
  const [commandFlushVersion, setCommandFlushVersion] = React.useState(0)
  const storeRef = React.useRef<FileSystemKernelRuntimeStore | null>(null)

  if (!storeRef.current) {
    storeRef.current = createFileSystemKernelRuntimeStore({
      initialState: createFileSystemKernelState({
        defaultPath,
        defaultQuery,
        defaultSelectedPath,
        defaultView,
        items,
      }),
      scheduleCommandFlush: () => {
        setCommandFlushVersion((version) => version + 1)
      },
    })
  }

  const store = storeRef.current
  const state = React.useSyncExternalStore(
    store.subscribe,
    store.getState,
    store.getState
  )
  const dispatch = React.useCallback<FileSystemDispatch>(
    (event) => {
      store.dispatch(event)
    },
    [store]
  )
  const getState = React.useCallback(() => store.getState(), [store])

  React.useEffect(() => {
    dispatch({ items, type: "items.replaced" })
  }, [dispatch, items])

  useFileSystemControlledProps({
    dispatch,
    path,
    query,
    selectedPath,
    view,
  })

  const folderTask = useFileSystemFolderTask({
    dispatch,
    getState,
    loadChildren,
  })

  React.useEffect(() => {
    void folderTask.ensureChildren(state.path).catch(() => {})
  }, [folderTask, state.path])

  const callbacks = React.useMemo(
    () => ({
      onFileCommand,
      onPathChange,
      onQueryChange,
      onSelectionChange,
      onViewChange,
    }),
    [
      onFileCommand,
      onPathChange,
      onQueryChange,
      onSelectionChange,
      onViewChange,
    ]
  )

  useFileSystemKernelCommandEffects({
    callbacks,
    consumeCommands: store.consumeCommands,
    flushVersion: commandFlushVersion,
    folderTask,
  })

  return React.useMemo(
    () => ({
      dispatch,
      ensureChildren: folderTask.ensureChildren,
      getState,
      state,
    }),
    [dispatch, folderTask.ensureChildren, getState, state]
  )
}

function createFileSystemKernelRuntimeStore({
  initialState,
  scheduleCommandFlush,
}: {
  initialState: FileSystemKernelState
  scheduleCommandFlush: () => void
}): FileSystemKernelRuntimeStore {
  const listeners = new Set<() => void>()
  let commandQueue: FileSystemKernelCommand[] = []
  let state = initialState

  return {
    consumeCommands: () => {
      const commands = commandQueue

      commandQueue = []
      return commands
    },
    dispatch: (event) => {
      const result = reduceFileSystemKernel(state, event)

      if (result.state !== state) {
        state = result.state
        for (const listener of listeners) listener()
      }

      if (result.commands.length) {
        commandQueue = [...commandQueue, ...result.commands]
        scheduleCommandFlush()
      }

      return result
    },
    getState: () => state,
    subscribe: (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}
