import type { FileTreeRowDecoration } from "@pierre/trees"

import type { FileSystemController } from "./file-system-controller"
import { entryKindLabel } from "./file-system-query"
import type { FileSystemEntry } from "./file-system-types"
import { formatFileSystemSize } from "./file-system-utils"

export const FILE_SYSTEM_PIERRE_ROW_CSS = `
  :host {
    --trees-selected-bg: hsl(var(--accent));
    --trees-selected-fg: hsl(var(--accent-foreground));
    --trees-hover-bg: hsl(var(--muted) / 0.55);
    --trees-focus-ring: hsl(var(--ring));
    --trees-radius: calc(var(--radius) - 2px);
    --trees-fg: hsl(var(--foreground));
    --trees-fg-muted: hsl(var(--muted-foreground));
    --trees-icon-color: hsl(var(--muted-foreground));
    font: inherit;
  }

  [data-item] {
    border-radius: calc(var(--radius) - 2px);
    color: var(--trees-fg);
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
`

export function fileSystemPierreRowDecoration(
  entry: FileSystemEntry,
  controller: FileSystemController
): FileTreeRowDecoration {
  if (entry.kind === "folder") {
    if (controller.loadingFolders.has(entry.path)) {
      return { text: "Loading", title: "Folder" }
    }

    const error = controller.folderErrors.get(entry.path)

    if (error) {
      return { text: error, title: "Folder" }
    }

    const childCount = controller.index.children.get(entry.path)?.length

    return {
      text: childCount === undefined ? "" : pluralizeItemCount(childCount),
      title: "Folder",
    }
  }

  return {
    text: formatFileSystemSize(entry.size),
    title: entryKindLabel(entry),
  }
}

function pluralizeItemCount(count: number): string {
  return `${count} ${count === 1 ? "item" : "items"}`
}
