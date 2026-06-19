import type {
  FileSystemEntry,
  FileSystemFileEntry,
  FileSystemFolderEntry,
  FileSystemIndex,
  FileSystemItem,
} from "./file-system-types";

export function normalizeFolderPath(path: string | undefined | null): string {
  if (!path || path === "/") return "";
  const trimmed = path.replace(/^\/+/, "");
  return trimmed.endsWith("/") ? trimmed : `${trimmed}/`;
}

export function normalizeFilePath(path: string): string {
  return path.replace(/^\/+/, "").replace(/\/+$/, "");
}

export function pathName(path: string): string {
  const trimmed = path.endsWith("/") ? path.slice(0, -1) : path;
  const separatorIndex = trimmed.lastIndexOf("/");
  return separatorIndex === -1 ? trimmed : trimmed.slice(separatorIndex + 1);
}

export function pathParent(path: string): string {
  const trimmed = path.endsWith("/") ? path.slice(0, -1) : path;
  const separatorIndex = trimmed.lastIndexOf("/");
  return separatorIndex === -1 ? "" : `${trimmed.slice(0, separatorIndex)}/`;
}

export function buildFileSystemIndex(items: readonly FileSystemItem[]) {
  const folders = new Map<string, FileSystemFolderEntry>();
  const files = new Map<string, FileSystemFileEntry>();

  const ensureFolderChain = (folderPath: string) => {
    let path = normalizeFolderPath(folderPath);

    while (path && !folders.has(path)) {
      folders.set(path, {
        kind: "folder",
        name: pathName(path),
        parentPath: pathParent(path),
        path,
      });
      path = pathParent(path);
    }
  };

  for (const item of items) {
    if (item.kind === "folder") {
      const path = normalizeFolderPath(item.path);
      if (!path) continue;

      folders.set(path, {
        ...item,
        name: item.name ?? pathName(path),
        parentPath: normalizeFolderPath(item.parentPath ?? pathParent(path)),
        path,
      });
      ensureFolderChain(pathParent(path));
      continue;
    }

    const path = normalizeFilePath(item.path);
    if (!path) continue;

    files.set(path, {
      ...item,
      key: item.key ?? path,
      name: item.name ?? pathName(path),
      parentPath: normalizeFolderPath(item.parentPath ?? pathParent(path)),
      path,
    });
    ensureFolderChain(pathParent(path));
  }

  const children = new Map<string, FileSystemEntry[]>();
  const pushChild = (entry: FileSystemEntry) => {
    const siblings = children.get(entry.parentPath);

    if (siblings) {
      siblings.push(entry);
    } else {
      children.set(entry.parentPath, [entry]);
    }
  };

  for (const folder of folders.values()) pushChild(folder);
  for (const file of files.values()) pushChild(file);
  for (const siblings of children.values()) siblings.sort(compareEntryNames);

  deriveFolderModifiedDates({ children, files, folders });

  return { children, files, folders } satisfies FileSystemIndex;
}

export function compareEntryNames(
  left: Pick<FileSystemEntry, "kind" | "name">,
  right: Pick<FileSystemEntry, "kind" | "name">,
) {
  if (left.kind !== right.kind) return left.kind === "folder" ? -1 : 1;
  return left.name.localeCompare(right.name, undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

export function folderHasChildren(
  index: FileSystemIndex,
  folder: FileSystemFolderEntry,
) {
  return (
    folder.hasChildren === true ||
    (index.children.get(folder.path)?.length ?? 0) > 0
  );
}

function deriveFolderModifiedDates(index: FileSystemIndex) {
  const foldersDeepestFirst = [...index.folders.values()].sort(
    (left, right) => right.path.length - left.path.length,
  );

  for (const folder of foldersDeepestFirst) {
    if (folder.updatedAt) continue;

    let newestTime = Number.NEGATIVE_INFINITY;
    let newestValue: string | undefined;

    for (const child of index.children.get(folder.path) ?? []) {
      const value = child.updatedAt ?? child.createdAt;
      const time = value ? Date.parse(value) : Number.NaN;

      if (!Number.isNaN(time) && time > newestTime) {
        newestTime = time;
        newestValue = value;
      }
    }

    if (newestValue) folder.updatedAt = newestValue;
  }
}
