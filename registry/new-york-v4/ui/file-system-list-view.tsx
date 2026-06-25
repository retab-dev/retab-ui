"use client";

import * as React from "react";
import {
  createFileTreeIconResolver,
  getBuiltInSpriteSheet,
} from "@pierre/trees";
import { AlertCircle, ChevronDown, ChevronRight, Folder } from "lucide-react";
import { useKeyedMountEffect } from "@/hooks/use-keyed-mount-effect";
import { useMountEffect } from "@/hooks/use-mount-effect";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

import type { FileSystemBrowserController } from "./file-system-browser-controller";
import { entryKindLabel } from "./file-system-query";
import { FileSystemThumbnail } from "./file-system-thumbnail";
import type { FileSystemEntry, FileSystemFileEntry } from "./file-system-types";
import {
  formatFileSystemDate,
  formatFileSystemSize,
} from "./file-system-utils";
import { useFixedRowVirtualization } from "./fixed-grid-virtualization";

type FileSystemListRow =
  | {
      depth: number;
      entry: FileSystemEntry;
      id: string;
      isExpanded: boolean;
      kind: "entry";
    }
  | {
      depth: number;
      folder: FileSystemEntry;
      id: string;
      kind: "loading";
    }
  | {
      depth: number;
      error: string;
      folder: FileSystemEntry;
      id: string;
      kind: "error";
    };

const LIST_ROW_HEIGHT = 34;
const LIST_COLUMNS =
  "grid-cols-[minmax(13rem,1fr)_minmax(7rem,9rem)_minmax(5rem,7rem)_minmax(8rem,11rem)]";
const PIERRE_ICON_SPRITE_ROOT_ID = "file-system-pierre-icon-sprite-root";
const PIERRE_FILE_ICON_RESOLVER = createFileTreeIconResolver({
  colored: false,
  set: "complete",
});

export function FileSystemListView({
  controller,
}: {
  controller: FileSystemBrowserController;
}) {
  const { browser, fileActions } = controller;
  const [expandedPaths, setExpandedPaths] = React.useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [focusedPath, setFocusedPath] = React.useState<string | null>(
    browser.selectedPath,
  );
  const parentRef = React.useRef<HTMLDivElement | null>(null);
  const rows = React.useMemo(
    () =>
      createFileSystemListRows({
        currentPath: browser.currentPath,
        expandedPaths,
        folderErrors: browser.folderErrors,
        index: browser.index,
        isSearching: browser.query.search.trim().length > 0,
        loadingFolders: browser.loadingFolders,
      }),
    [
      browser.currentPath,
      browser.folderErrors,
      browser.index,
      browser.loadingFolders,
      browser.query.search,
      expandedPaths,
    ],
  );
  const { virtualRows, totalRowSize } = useFixedRowVirtualization({
    rowCount: rows.length,
    rowSize: LIST_ROW_HEIGHT,
    rowOverscan: 12,
    initialViewportHeight: 560,
    scrollRef: parentRef,
  });
  const entryRows = React.useMemo(
    () =>
      rows.filter(
        (row): row is Extract<FileSystemListRow, { kind: "entry" }> =>
          row.kind === "entry",
      ),
    [rows],
  );
  const focusedIndex = entryRows.findIndex(
    (row) => row.entry.path === (focusedPath ?? browser.selectedPath),
  );

  useKeyedMountEffect(`selected:${browser.selectedPath ?? "null"}`, () => {
    setFocusedPath(browser.selectedPath);
  });

  const toggleFolder = React.useCallback(
    (entry: FileSystemEntry, options?: { retry?: boolean }) => {
      if (entry.kind !== "folder") return;

      if (expandedPaths.has(entry.path) && !options?.retry) {
        setExpandedPaths((current) => {
          const next = new Set(current);
          next.delete(entry.path);
          return next;
        });
        return;
      }

      setExpandedPaths((current) => new Set(current).add(entry.path));
      void browser.ensureChildren(entry.path, options).catch(() => {});
    },
    [browser, expandedPaths],
  );
  const selectEntry = React.useCallback(
    (entry: FileSystemEntry) => {
      setFocusedPath(entry.path);
      browser.selectEntry(entry);
    },
    [browser],
  );
  const openEntry = React.useCallback(
    (entry: FileSystemEntry) => {
      selectEntry(entry);

      if (entry.kind === "folder") {
        browser.navigateTo(entry.path);
        return;
      }

      fileActions.openPreview(entry);
    },
    [browser, fileActions, selectEntry],
  );
  const focusEntryAt = React.useCallback(
    (index: number) => {
      const row = entryRows[Math.max(0, Math.min(index, entryRows.length - 1))];
      if (!row) return;

      selectEntry(row.entry);
    },
    [entryRows, selectEntry],
  );
  const handleKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (!entryRows.length) return;

      const currentIndex = focusedIndex >= 0 ? focusedIndex : 0;
      const current = entryRows[currentIndex]?.entry;

      if (event.key === "ArrowDown") {
        focusEntryAt(currentIndex + 1);
        event.preventDefault();
        return;
      }
      if (event.key === "ArrowUp") {
        focusEntryAt(currentIndex - 1);
        event.preventDefault();
        return;
      }
      if (event.key === "Enter" && current) {
        openEntry(current);
        event.preventDefault();
        return;
      }
      if (event.key === "ArrowRight" && current?.kind === "folder") {
        if (!expandedPaths.has(current.path)) {
          toggleFolder(current);
        } else {
          browser.navigateTo(current.path);
        }
        event.preventDefault();
        return;
      }
      if (event.key === "ArrowLeft" && current?.kind === "folder") {
        if (expandedPaths.has(current.path)) {
          toggleFolder(current);
          event.preventDefault();
        }
      }
    },
    [
      browser,
      entryRows,
      expandedPaths,
      focusEntryAt,
      focusedIndex,
      openEntry,
      toggleFolder,
    ],
  );

  if (!browser.entries.length) {
    return <FileSystemEmptyRows label="This folder is empty" />;
  }

  return (
    <div
      className="bg-background flex size-full min-h-0 flex-col"
      data-slot="file-system-list-view"
    >
      <PierreFileIconSprite />
      <div
        className={cn(
          "bg-muted/35 text-muted-foreground grid h-9 shrink-0 items-center border-b px-3 text-xs font-medium",
          LIST_COLUMNS,
        )}
      >
        <div>Name</div>
        <div>Type</div>
        <div className="text-right">Size</div>
        <div>Modified</div>
      </div>
      <div
        ref={parentRef}
        role="tree"
        aria-label="Files"
        tabIndex={0}
        onKeyDown={handleKeyDown}
        className="min-h-0 flex-1 overflow-auto outline-none"
      >
        <div
          className="relative min-w-[42rem]"
          style={{ height: totalRowSize }}
        >
          {virtualRows.map((virtualRow) => {
            const row = rows[virtualRow.index];
            if (!row) return null;

            return (
              <div
                key={row.id}
                className="absolute inset-x-0 top-0"
                style={{
                  height: virtualRow.size,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                {row.kind === "entry" ? (
                  <FileSystemListEntryRow
                    depth={row.depth}
                    entry={row.entry}
                    hasError={browser.folderErrors.has(row.entry.path)}
                    isExpanded={row.isExpanded}
                    isFocused={row.entry.path === focusedPath}
                    isSelected={row.entry.path === browser.selectedPath}
                    onOpen={openEntry}
                    onSelect={selectEntry}
                    onToggle={toggleFolder}
                  />
                ) : row.kind === "loading" ? (
                  <FileSystemListMessageRow depth={row.depth} label="Loading" />
                ) : (
                  <FileSystemListErrorRow
                    depth={row.depth}
                    error={row.error}
                    folder={row.folder}
                    onRetry={toggleFolder}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function FileSystemListEntryRow({
  depth,
  entry,
  hasError,
  isExpanded,
  isFocused,
  isSelected,
  onOpen,
  onSelect,
  onToggle,
}: {
  depth: number;
  entry: FileSystemEntry;
  hasError: boolean;
  isExpanded: boolean;
  isFocused: boolean;
  isSelected: boolean;
  onOpen: (entry: FileSystemEntry) => void;
  onSelect: (entry: FileSystemEntry) => void;
  onToggle: (entry: FileSystemEntry, options?: { retry?: boolean }) => void;
}) {
  return (
    <div
      role="treeitem"
      aria-expanded={entry.kind === "folder" ? isExpanded : undefined}
      aria-label={entry.name}
      aria-level={depth + 1}
      aria-selected={isSelected}
      data-path={entry.path}
      onClick={() => {
        onSelect(entry);
        if (entry.kind !== "folder") return;
        if (hasError) {
          onToggle(entry, { retry: true });
          return;
        }
        if (!isExpanded) onToggle(entry);
      }}
      onDoubleClick={() => onOpen(entry)}
      className={cn(
        "grid h-8 cursor-default items-center gap-3 px-3 text-sm outline-none",
        LIST_COLUMNS,
        isSelected
          ? "bg-primary text-primary-foreground"
          : isFocused
            ? "bg-accent"
            : "hover:bg-accent/50",
      )}
    >
      <div
        className="flex min-w-0 items-center gap-1.5"
        style={{ paddingLeft: `${depth * 1.125}rem` }}
      >
        {entry.kind === "folder" ? (
          <button
            type="button"
            aria-label={
              isExpanded ? `Collapse ${entry.name}` : `Expand ${entry.name}`
            }
            onClick={(event) => {
              event.stopPropagation();
              onToggle(entry);
            }}
            className="hover:bg-background/70 focus-visible:ring-ring flex size-5 shrink-0 items-center justify-center rounded-sm focus-visible:ring-2"
          >
            {isExpanded ? (
              <ChevronDown className="size-3.5" aria-hidden />
            ) : (
              <ChevronRight className="size-3.5" aria-hidden />
            )}
          </button>
        ) : (
          <span className="size-5 shrink-0" />
        )}
        {entry.kind === "folder" ? (
          <Folder
            className="text-muted-foreground size-4 shrink-0"
            aria-hidden
          />
        ) : shouldUseFileSystemListThumbnail(entry) ? (
          <FileSystemThumbnail
            file={entry}
            presentation="decorative"
            className="size-5 shrink-0 rounded-[3px]"
          />
        ) : (
          <PierreFileIcon file={entry} className="size-4 shrink-0" />
        )}
        <span className="min-w-0 truncate">{entry.name}</span>
      </div>
      <div className="text-muted-foreground truncate">
        {entryKindLabel(entry)}
      </div>
      <div className="text-muted-foreground truncate text-right">
        {entry.kind === "file" ? formatFileSystemSize(entry.size) : ""}
      </div>
      <div className="text-muted-foreground truncate">
        {formatFileSystemDate(entry.updatedAt ?? entry.createdAt)}
      </div>
    </div>
  );
}

function PierreFileIconSprite() {
  useMountEffect(() => {
    if (document.getElementById(PIERRE_ICON_SPRITE_ROOT_ID)) return;

    const root = document.createElement("div");
    root.id = PIERRE_ICON_SPRITE_ROOT_ID;
    root.hidden = true;
    root.innerHTML = getBuiltInSpriteSheet("complete");
    document.body.appendChild(root);
  });

  return null;
}

function PierreFileIcon({
  className,
  file,
}: {
  className?: string;
  file: FileSystemFileEntry;
}) {
  const icon = PIERRE_FILE_ICON_RESOLVER.resolveIcon(
    "file-tree-icon-file",
    file.name,
  );
  const width = icon.width ?? 16;
  const height = icon.height ?? 16;

  return (
    <svg
      aria-hidden
      className={cn("text-muted-foreground", className)}
      data-icon-name={icon.remappedFrom ?? icon.name}
      data-icon-token={icon.token}
      fill="currentColor"
      height={height}
      viewBox={icon.viewBox ?? `0 0 ${width} ${height}`}
      width={width}
    >
      <use href={`#${icon.name.replace(/^#/, "")}`} />
    </svg>
  );
}

function shouldUseFileSystemListThumbnail(file: FileSystemFileEntry) {
  if (file.previewImageUrl || file.previewSource) return true;

  const mimeType = file.mimeType ?? file.source?.mimeType ?? "";
  if (mimeType === "application/pdf" || mimeType.startsWith("image/")) {
    return true;
  }

  return /\.(avif|bmp|gif|jpe?g|pdf|png|svg|tiff?|webp)$/i.test(file.name);
}

function FileSystemListMessageRow({
  depth,
  label,
}: {
  depth: number;
  label: string;
}) {
  return (
    <div
      className={cn(
        "text-muted-foreground grid h-8 items-center gap-3 px-3 text-sm",
        LIST_COLUMNS,
      )}
    >
      <div style={{ paddingLeft: `${(depth + 1) * 1.125}rem` }}>{label}</div>
      <div />
      <div />
      <div />
    </div>
  );
}

function FileSystemListErrorRow({
  depth,
  error,
  folder,
  onRetry,
}: {
  depth: number;
  error: string;
  folder: FileSystemEntry;
  onRetry: (entry: FileSystemEntry, options?: { retry?: boolean }) => void;
}) {
  return (
    <div
      className={cn(
        "text-destructive grid h-8 items-center gap-3 px-3 text-sm",
        LIST_COLUMNS,
      )}
    >
      <div
        className="flex min-w-0 items-center gap-2"
        style={{ paddingLeft: `${(depth + 1) * 1.125}rem` }}
      >
        <AlertCircle className="size-3.5 shrink-0" aria-hidden />
        <span className="truncate">{error}</span>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-6 px-2"
          onClick={() => onRetry(folder, { retry: true })}
        >
          Retry
        </Button>
      </div>
      <div />
      <div />
      <div />
    </div>
  );
}

function createFileSystemListRows({
  currentPath,
  expandedPaths,
  folderErrors,
  index,
  isSearching,
  loadingFolders,
}: {
  currentPath: string;
  expandedPaths: ReadonlySet<string>;
  folderErrors: ReadonlyMap<string, string>;
  index: { children: Map<string, FileSystemEntry[]> };
  isSearching: boolean;
  loadingFolders: ReadonlySet<string>;
}): FileSystemListRow[] {
  const rows: FileSystemListRow[] = [];
  const appendChildren = (path: string, depth: number) => {
    const children = index.children.get(path) ?? [];

    for (const entry of children) {
      const hasVisibleFolderState =
        entry.kind === "folder" &&
        (loadingFolders.has(entry.path) || folderErrors.has(entry.path));
      const isExpanded =
        entry.kind === "folder" &&
        (isSearching || expandedPaths.has(entry.path) || hasVisibleFolderState);

      rows.push({
        depth,
        entry,
        id: `entry:${entry.path}`,
        isExpanded,
        kind: "entry",
      });

      if (entry.kind !== "folder" || !isExpanded) continue;

      if (loadingFolders.has(entry.path)) {
        rows.push({
          depth,
          folder: entry,
          id: `loading:${entry.path}`,
          kind: "loading",
        });
      }

      const error = folderErrors.get(entry.path);
      if (error) {
        rows.push({
          depth,
          error,
          folder: entry,
          id: `error:${entry.path}`,
          kind: "error",
        });
      }

      appendChildren(entry.path, depth + 1);
    }
  };

  appendChildren(currentPath, 0);
  return rows;
}

export function FileSystemEmptyRows({ label }: { label: string }) {
  return (
    <div className="text-muted-foreground flex size-full items-center justify-center text-sm">
      {label}
    </div>
  );
}
