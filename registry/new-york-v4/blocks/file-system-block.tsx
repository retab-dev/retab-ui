"use client"

import * as React from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

import { FileSystem } from "@/components/ui/file-system"

import {
  DEFAULT_FILE_SYSTEM_DEMO_QUERY,
  FILE_SYSTEM_DEMO_ITEMS,
  LARGE_FILE_SYSTEM_DEMO_ITEMS,
  collectFileSystemDemoFolderPaths,
  collectFileSystemDemoItemPaths,
  formatFileSystemDemoState,
  parseFileSystemDemoState,
  type FileSystemDemoState,
} from "./file-system-demo-state"

const DEFAULT_FILE_SYSTEM_DEMO_STATE: FileSystemDemoState = {
  path: "",
  query: DEFAULT_FILE_SYSTEM_DEMO_QUERY,
  selectedPath: null,
  view: "list",
}

export function FileSystemBlock() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const isLarge = searchParams.get("large") === "true"
  const items = isLarge ? LARGE_FILE_SYSTEM_DEMO_ITEMS : FILE_SYSTEM_DEMO_ITEMS
  const folderPaths = React.useMemo(
    () => collectFileSystemDemoFolderPaths(items),
    [items]
  )
  const itemPaths = React.useMemo(
    () => collectFileSystemDemoItemPaths(items),
    [items]
  )
  const parsedState = React.useMemo(
    () =>
      parseFileSystemDemoState(searchParams, {
        fallbackState: DEFAULT_FILE_SYSTEM_DEMO_STATE,
        folderPaths,
        itemPaths,
      }),
    [folderPaths, itemPaths, searchParams]
  )
  const [state, setState] = React.useState(parsedState)
  const stateRef = React.useRef(parsedState)

  React.useEffect(() => {
    stateRef.current = parsedState
    setState(parsedState)
  }, [parsedState])

  const replaceState = React.useCallback(
    (patch: Partial<FileSystemDemoState>) => {
      const nextState = { ...stateRef.current, ...patch }
      const nextParams = new URLSearchParams(
        formatFileSystemDemoState(nextState, DEFAULT_FILE_SYSTEM_DEMO_STATE)
      )

      if (isLarge) nextParams.set("large", "true")
      stateRef.current = nextState
      setState(nextState)
      router.replace(`${pathname}?${nextParams.toString()}`, {
        scroll: false,
      })
    },
    [isLarge, pathname, router]
  )

  return (
    <FileSystem
      className="h-full min-h-[680px]"
      items={items}
      onPathChange={(path) => replaceState({ path, selectedPath: null })}
      onQueryChange={(query) => replaceState({ query })}
      onSelectionChange={(entry) =>
        replaceState({ selectedPath: entry?.path ?? null })
      }
      onViewChange={(view) => replaceState({ view })}
      path={state.path}
      query={state.query}
      selectedPath={state.selectedPath}
      view={state.view}
    />
  )
}
