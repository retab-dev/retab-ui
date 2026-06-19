import type * as React from "react";

import type { ViewerSource } from "@/lib/viewer-source";

export type FileSystemView = "list" | "grid" | "columns";

export type FileSystemFolderItem = {
  kind: "folder";
  path: string;
  name?: string;
  parentPath?: string;
  hasChildren?: boolean;
  createdAt?: string;
  updatedAt?: string;
  metadata?: Record<string, string>;
};

export type FileSystemFileItem = {
  kind: "file";
  path: string;
  key?: string;
  name?: string;
  parentPath?: string;
  mimeType?: string;
  size?: number;
  createdAt?: string;
  updatedAt?: string;
  etag?: string;
  source?: ViewerSource;
  previewSource?: ViewerSource;
  previewImageUrl?: string | null;
  metadata?: Record<string, string>;
};

export type FileSystemItem = FileSystemFolderItem | FileSystemFileItem;

export type FileSystemLoadChildrenArgs = {
  path: string;
  cursor: string | null;
  signal: AbortSignal;
};

export type FileSystemLoadChildrenResult = {
  items: FileSystemItem[];
  nextCursor?: string | null;
};

export type FileSystemResolveSourceArgs = {
  file: FileSystemFileItem;
  signal: AbortSignal;
};

export type FileSystemSortKey = "name" | "kind" | "size" | "updatedAt";

export type FileSystemSortState = {
  direction: "asc" | "desc";
  key: FileSystemSortKey;
};

export type FileSystemQueryState = {
  search: string;
  sort: FileSystemSortState;
};

export type FileSystemProps = {
  items: FileSystemItem[];
  title?: string;
  className?: string;
  defaultPath?: string;
  path?: string;
  onPathChange?: (path: string) => void;
  defaultView?: FileSystemView;
  view?: FileSystemView;
  onViewChange?: (view: FileSystemView) => void;
  defaultQuery?: Partial<FileSystemQueryState>;
  query?: FileSystemQueryState;
  onQueryChange?: (query: FileSystemQueryState) => void;
  selectedPath?: string | null;
  defaultSelectedPath?: string | null;
  onSelectionChange?: (item: FileSystemItem | null) => void;
  loadChildren?: (
    args: FileSystemLoadChildrenArgs,
  ) => Promise<FileSystemLoadChildrenResult>;
  resolveSource?: (
    args: FileSystemResolveSourceArgs,
  ) => Promise<ViewerSource | null>;
  onFileOpen?: (file: FileSystemFileItem, source: ViewerSource | null) => void;
  renderFileActions?: (file: FileSystemFileItem) => React.ReactNode;
  renderMetadata?: (item: FileSystemItem) => React.ReactNode;
};

export type FileSystemFolderEntry = FileSystemFolderItem & {
  name: string;
  parentPath: string;
};

export type FileSystemFileEntry = FileSystemFileItem & {
  key: string;
  name: string;
  parentPath: string;
};

export type FileSystemEntry = FileSystemFolderEntry | FileSystemFileEntry;

export type FileSystemIndex = {
  children: Map<string, FileSystemEntry[]>;
  files: Map<string, FileSystemFileEntry>;
  folders: Map<string, FileSystemFolderEntry>;
};
