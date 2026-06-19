"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { useKeyedMountEffect } from "@/hooks/use-keyed-mount-effect";
import { FileSystem } from "@/components/ui/file-system";

import {
  collectFileSystemDemoFolderPaths,
  collectFileSystemDemoItemPaths,
  DEFAULT_FILE_SYSTEM_DEMO_QUERY,
  FILE_SYSTEM_DEMO_ITEMS,
  formatFileSystemDemoState,
  LARGE_FILE_SYSTEM_DEMO_ITEMS,
  parseFileSystemDemoState,
  type FileSystemDemoState,
} from "./file-system-demo-state";

const DEFAULT_FILE_SYSTEM_DEMO_STATE: FileSystemDemoState = {
  path: "",
  query: DEFAULT_FILE_SYSTEM_DEMO_QUERY,
  selectedPath: null,
  view: "list",
};

export function FileSystemBlock() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isLarge = searchParams.get("large") === "true";
  const items = isLarge ? LARGE_FILE_SYSTEM_DEMO_ITEMS : FILE_SYSTEM_DEMO_ITEMS;
  const folderPaths = React.useMemo(
    () => collectFileSystemDemoFolderPaths(items),
    [items],
  );
  const itemPaths = React.useMemo(
    () => collectFileSystemDemoItemPaths(items),
    [items],
  );
  const parsedState = React.useMemo(
    () =>
      parseFileSystemDemoState(searchParams, {
        fallbackState: DEFAULT_FILE_SYSTEM_DEMO_STATE,
        folderPaths,
        itemPaths,
      }),
    [folderPaths, itemPaths, searchParams],
  );
  const [state, setState] = React.useState(parsedState);
  const stateRef = React.useRef(parsedState);
  const parsedStateKey = React.useMemo(
    () =>
      JSON.stringify(
        formatFileSystemDemoState(parsedState, DEFAULT_FILE_SYSTEM_DEMO_STATE),
      ),
    [parsedState],
  );

  useKeyedMountEffect(parsedStateKey, () => {
    stateRef.current = parsedState;
    setState(parsedState);
  });

  const replaceState = React.useCallback(
    (patch: Partial<FileSystemDemoState>) => {
      const nextState = { ...stateRef.current, ...patch };
      const nextParams = new URLSearchParams(
        formatFileSystemDemoState(nextState, DEFAULT_FILE_SYSTEM_DEMO_STATE),
      );

      if (isLarge) nextParams.set("large", "true");
      stateRef.current = nextState;
      setState(nextState);
      router.replace(`${pathname}?${nextParams.toString()}`, {
        scroll: false,
      });
    },
    [isLarge, pathname, router],
  );

  return (
    <FileSystem
      className="h-[680px]"
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
  );
}
