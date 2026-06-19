"use client";

import * as React from "react";

import {
  createFileSystemBrowserController,
  type FileSystemBrowserController,
} from "./file-system-browser-controller";
import type {
  FileSystemHeaderState,
  FileSystemSelectionState as FileSystemSelectionDomainState,
} from "./file-system-browser-state";
import { createFileSystemHeaderState } from "./file-system-browser-state";
import { FileSystemColumnsView } from "./file-system-columns-view";
import {
  FileSystemCommandBar,
  FileSystemStatusBar,
  FileSystemToolbar,
} from "./file-system-controls";
import { FileSystemGridView } from "./file-system-grid-view";
import { FileSystemListView } from "./file-system-list-view";
import { useFileSystem } from "./file-system-provider";
import {
  useFileSystemSelectionSourceTask,
  type FileSystemSelectionSourceTask,
} from "./file-system-selection-source-task";
import type {
  FileSystemEntry,
  FileSystemFileEntry,
  FileSystemProps,
} from "./file-system-types";

export type FileSystemBrowserPartState = FileSystemBrowserController;

export type { FileSystemHeaderState } from "./file-system-browser-state";

export type FileSystemSelectionState = FileSystemSelectionDomainState & {
  renderFileActions?: FileSystemProps["renderFileActions"];
  renderMetadata?: FileSystemProps["renderMetadata"];
};

export type FileSystemSelectionRenderState = FileSystemSelectionState & {
  file: FileSystemFileEntry | null;
  retry: () => void;
  source: FileSystemSelectionSourceTask["source"];
  sourceState: FileSystemSelectionSourceTask;
};

export function useFileSystemHeader(): FileSystemHeaderState {
  const state = useFileSystem();

  return createFileSystemHeaderState({
    browser: state.browser,
    title: state.title,
  });
}

export function useFileSystemBrowser(): FileSystemBrowserPartState {
  const state = useFileSystem();

  return createFileSystemBrowserController({
    browser: state.browser,
    openPreview: state.openPreview.open,
    resolveFileSource: state.selection.resolveSource,
  });
}

export function useFileSystemSelection(): FileSystemSelectionState {
  const state = useFileSystem();

  return {
    ...state.selection,
    renderFileActions: state.renderers.renderFileActions,
    renderMetadata: state.renderers.renderMetadata,
  };
}

export function useFileSystemSelectedItem(): FileSystemEntry | null {
  return useFileSystemSelection().entry;
}

export function useFileSystemSelectedSource(): FileSystemSelectionSourceTask {
  const selection = useFileSystemSelection();
  const file = selection.entry?.kind === "file" ? selection.entry : null;

  return useFileSystemSelectionSourceTask(file, selection.resolveSource);
}

export function FileSystemHeader() {
  const header = useFileSystemHeader();

  return (
    <>
      <FileSystemToolbar {...header} />
      <FileSystemCommandBar controller={header} />
    </>
  );
}

export function FileSystemBrowser() {
  const controller = useFileSystemBrowser();
  const { view } = controller.browser;

  return (
    <div className="flex size-full min-h-0 flex-col">
      <div className="min-h-0 flex-1">
        {view === "list" ? (
          <FileSystemListView controller={controller} />
        ) : view === "grid" ? (
          <FileSystemGridView controller={controller} />
        ) : (
          <FileSystemColumnsView controller={controller} />
        )}
      </div>
      <FileSystemStatusBar browser={controller.browser} />
    </div>
  );
}

export function FileSystemSelection({
  children,
}: {
  children: (state: FileSystemSelectionRenderState) => React.ReactNode;
}) {
  const selection = useFileSystemSelection();
  const file = selection.entry?.kind === "file" ? selection.entry : null;
  const sourceState = useFileSystemSelectionSourceTask(
    file,
    selection.resolveSource,
  );

  return (
    <>
      {children({
        ...selection,
        file,
        retry: sourceState.retry,
        source: sourceState.source,
        sourceState,
      })}
    </>
  );
}
