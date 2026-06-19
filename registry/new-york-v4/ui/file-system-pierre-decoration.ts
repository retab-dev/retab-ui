import type { FileTreeRowDecoration } from "@pierre/trees";

import type { FileSystemPierreDecorationState } from "./file-system-pierre-adapter";
import { entryKindLabel } from "./file-system-query";
import type { FileSystemEntry } from "./file-system-types";
import { formatFileSystemSize } from "./file-system-utils";

type FileSystemPierreRowMeta = {
  detailLabel: string;
  kindLabel: string;
};

export const FILE_SYSTEM_PIERRE_ROW_CSS = `
  :host {
    --trees-selected-bg: hsl(var(--accent));
    --trees-selected-fg: hsl(var(--accent-foreground));
    --trees-hover-bg: hsl(var(--muted) / 0.55);
    --trees-focus-ring: hsl(var(--ring));
    --trees-radius: 0.375rem;
    --trees-fg: hsl(var(--foreground));
    --trees-fg-muted: hsl(var(--muted-foreground));
    --trees-file-icon-color: hsl(var(--muted-foreground));
    font: inherit;
  }

  [data-item] {
    border-radius: var(--trees-radius);
    color: var(--trees-fg);
  }

  [data-item][data-item-selected='true'] [data-item-section='icon'] {
    color: var(--trees-selected-fg);
  }

  [data-item-section='label'] {
    min-width: 0;
    font-size: 0.875rem;
  }

  [data-item-section='decoration'] {
    flex: 0 0 auto;
    color: var(--trees-fg-muted);
    font-size: 0.8125rem;
  }

  [data-item-section='decoration'] > span {
    display: grid;
    grid-template-columns: minmax(5rem, 8rem) minmax(3.5rem, 5rem);
    gap: 0.75rem;
    min-width: 11rem;
    align-items: center;
    white-space: nowrap;
    text-align: right;
  }

  [data-item-section='decoration'] > span::before {
    min-width: 0;
    overflow: hidden;
    content: attr(title);
    text-align: left;
    text-overflow: ellipsis;
  }
`;

export function fileSystemPierreRowDecoration(
  entry: FileSystemEntry,
  decoration: FileSystemPierreDecorationState,
): FileTreeRowDecoration {
  const meta = fileSystemPierreRowMeta(entry, decoration);

  // Pierre exposes a single decoration text plus title; CSS reads title as
  // the left metadata column so this transport detail stays local.
  return {
    text: meta.detailLabel,
    title: meta.kindLabel,
  };
}

function fileSystemPierreRowMeta(
  entry: FileSystemEntry,
  decoration: FileSystemPierreDecorationState,
): FileSystemPierreRowMeta {
  if (entry.kind === "folder") {
    if (decoration.loadingFolders.has(entry.path)) {
      return { detailLabel: "Loading", kindLabel: "Folder" };
    }

    const error = decoration.folderErrors.get(entry.path);

    if (error) {
      return { detailLabel: error, kindLabel: "Folder" };
    }

    const childCount = decoration.index.children.get(entry.path)?.length;

    return {
      detailLabel:
        childCount === undefined ? "" : pluralizeItemCount(childCount),
      kindLabel: "Folder",
    };
  }

  return {
    detailLabel: formatFileSystemSize(entry.size),
    kindLabel: entryKindLabel(entry),
  };
}

function pluralizeItemCount(count: number): string {
  return `${count} ${count === 1 ? "item" : "items"}`;
}
