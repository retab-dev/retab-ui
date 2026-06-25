"use client";

import * as React from "react";
import { ChevronRight, Folder } from "lucide-react";

import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";

import type { FileSystemBrowserController } from "./file-system-browser-controller";
import { folderHasChildren, pathParent } from "./file-system-index";
import { FileSystemThumbnail } from "./file-system-thumbnail";
import type { FileSystemEntry } from "./file-system-types";
import { useFixedRowVirtualization } from "./fixed-grid-virtualization";
import { useFileSystemRovingFocus } from "./use-file-system-roving-focus";

const COLUMN_ROW_HEIGHT = 32;

// The columns view stacks multiple `w-64` (16rem) columns side by side, so it
// needs a substantially wider sidebar than the single-pane list/tree views.
export const FILE_SYSTEM_SIDEBAR_WIDTH = "min(22rem, 85vw)";
export const FILE_SYSTEM_COLUMNS_SIDEBAR_WIDTH =
  "min(clamp(32rem, 40vw, 40rem), 85vw)";

export function FileSystemColumnsView({
  controller,
}: {
  controller: FileSystemBrowserController;
}) {
  const { browser } = controller;
  const columnPaths = React.useMemo(() => {
    const paths = [browser.currentPath];
    const selectedPath = browser.selectedPath;

    if (!selectedPath?.startsWith(browser.currentPath)) return paths;

    const selectedEntry = browser.selectedEntry;
    const targetPath =
      selectedEntry?.kind === "folder"
        ? selectedEntry.path
        : (selectedEntry?.parentPath ?? browser.currentPath);
    const relativePath = targetPath.slice(browser.currentPath.length);
    let walkedPath = browser.currentPath;

    for (const segment of relativePath.split("/")) {
      if (!segment) continue;
      walkedPath = `${walkedPath}${segment}/`;
      paths.push(walkedPath);
    }

    return paths;
  }, [browser.currentPath, browser.selectedEntry, browser.selectedPath]);

  return (
    <ScrollArea
      orientation="horizontal"
      viewportClassName="overscroll-x-contain"
    >
      <div className="flex h-full min-w-full">
        {columnPaths.map((path, index) => (
          <FileSystemColumn
            key={path || "(root)"}
            controller={controller}
            isLast={index === columnPaths.length - 1}
            path={path}
          />
        ))}
      </div>
    </ScrollArea>
  );
}

function FileSystemColumn({
  controller,
  isLast,
  path,
}: {
  controller: FileSystemBrowserController;
  isLast: boolean;
  path: string;
}) {
  const { browser, fileActions } = controller;
  const viewportRef = React.useRef<HTMLDivElement | null>(null);
  const entries = React.useMemo(
    () => browser.index.children.get(path) ?? [],
    [browser.index.children, path],
  );
  const { scrollToRow, totalRowSize, virtualRows } = useFixedRowVirtualization({
    rowCount: entries.length,
    rowSize: COLUMN_ROW_HEIGHT,
    rowOverscan: 10,
    initialViewportHeight: 560,
    scrollRef: viewportRef,
  });
  const rovingFocus = useFileSystemRovingFocus({
    entries,
    getScrollIndex: (entry) =>
      entries.findIndex((candidate) => candidate.path === entry.path),
    onSelect: (entry) => {
      browser.selectEntry(entry);
      if (entry.kind === "folder") {
        void browser.ensureChildren(entry.path).catch(() => {});
      }
    },
    scrollToIndex: (index) => {
      if (index !== -1) {
        scrollToRow({ rowIndex: index, align: "center", behavior: "auto" });
      }
    },
    selectedPath: browser.selectedPath,
  });
  const openEntry = React.useCallback(
    (entry: FileSystemEntry) => {
      if (entry.kind === "folder") {
        browser.navigateTo(entry.path);
      } else {
        fileActions.openPreview(entry);
      }
    },
    [browser.navigateTo, fileActions],
  );
  const selectParent = React.useCallback(() => {
    const selectedEntry = browser.selectedEntry;
    if (!selectedEntry) return;

    const parentPath =
      selectedEntry.kind === "folder"
        ? pathParent(selectedEntry.path)
        : selectedEntry.parentPath;
    const parent = parentPath
      ? (browser.rawIndex.folders.get(parentPath) ?? null)
      : null;

    if (parent) browser.selectEntry(parent);
  }, [browser.rawIndex.folders, browser.selectEntry, browser.selectedEntry]);
  const selectChild = React.useCallback(() => {
    const selectedEntry = browser.selectedEntry;
    if (selectedEntry?.kind !== "folder") return;

    void browser.selectFirstChildAfterEnsure(selectedEntry.path);
  }, [browser.selectFirstChildAfterEnsure, browser.selectedEntry]);
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      rovingFocus.selectByOffset(event.key === "ArrowDown" ? 1 : -1);
      event.preventDefault();
      return;
    }
    if (event.key === "Home" || event.key === "End") {
      rovingFocus.selectBoundary(event.key === "Home" ? "first" : "last");
      event.preventDefault();
      return;
    }
    if (event.key === "ArrowRight") {
      selectChild();
      event.preventDefault();
      return;
    }
    if (event.key === "ArrowLeft") {
      selectParent();
      event.preventDefault();
      return;
    }
    if (event.key === "Enter" && browser.selectedEntry) {
      openEntry(browser.selectedEntry);
      event.preventDefault();
      return;
    }

    rovingFocus.selectTypeAhead(event);
  };

  return (
    <div
      className={cn("w-64 shrink-0 border-r", isLast && "flex-1")}
      role="listbox"
      aria-label={path || "Files"}
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      <div ref={viewportRef} className="h-full overflow-auto p-1.5">
        {entries.length ? (
          <div className="relative" style={{ height: totalRowSize }}>
            {virtualRows.map((virtualRow) => {
              const entry = entries[virtualRow.index];
              if (!entry) return null;

              return (
                <FileSystemColumnRow
                  key={entry.path}
                  controller={controller}
                  entry={entry}
                  ref={(element) => {
                    rovingFocus.registerEntryRef(entry.path, element);
                  }}
                  style={{ transform: `translateY(${virtualRow.start}px)` }}
                />
              );
            })}
          </div>
        ) : (
          <div className="text-muted-foreground px-2 py-1.5 text-xs">
            This folder is empty
          </div>
        )}
      </div>
    </div>
  );
}

const FileSystemColumnRow = React.forwardRef<
  HTMLButtonElement,
  {
    controller: FileSystemBrowserController;
    entry: FileSystemEntry;
    style: React.CSSProperties;
  }
>(function FileSystemColumnRow({ controller, entry, style }, ref) {
  const { browser, fileActions } = controller;
  const selectedPath = browser.selectedPath;
  const isSelected = entry.path === selectedPath;
  const isOnTrail =
    entry.kind === "folder" &&
    selectedPath?.startsWith(entry.path) &&
    pathParent(selectedPath) !== entry.parentPath;

  return (
    <button
      ref={ref}
      type="button"
      role="option"
      aria-selected={isSelected}
      tabIndex={isSelected || !selectedPath ? 0 : -1}
      onClick={() => {
        browser.selectEntry(entry);
        if (entry.kind === "folder") {
          void browser.ensureChildren(entry.path).catch(() => {});
        }
      }}
      onDoubleClick={() => {
        if (entry.kind === "folder") {
          browser.navigateTo(entry.path);
        } else {
          fileActions.openPreview(entry);
        }
      }}
      className={cn(
        "focus-visible:ring-ring absolute inset-x-0 flex h-8 shrink-0 items-center gap-2 rounded-sm px-2 text-left text-sm outline-none focus-visible:ring-2",
        isSelected
          ? "bg-primary text-primary-foreground"
          : isOnTrail
            ? "bg-accent"
            : "hover:bg-accent/50",
      )}
      style={style}
    >
      {entry.kind === "folder" ? (
        <Folder className="text-muted-foreground size-4 shrink-0" aria-hidden />
      ) : (
        <FileSystemThumbnail
          file={entry}
          resolveFileSource={fileActions.resolveFileSource}
          className="w-4 shrink-0"
        />
      )}
      <span className="min-w-0 flex-1 truncate">{entry.name}</span>
      {entry.kind === "folder" && folderHasChildren(browser.rawIndex, entry) ? (
        <ChevronRight className="text-muted-foreground size-3.5 shrink-0" />
      ) : null}
    </button>
  );
});
