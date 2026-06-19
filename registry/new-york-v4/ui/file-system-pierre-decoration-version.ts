"use client";

import * as React from "react";

export function useFileSystemPierreDecorationVersion({
  folderErrors,
  loadingFolders,
}: {
  folderErrors: ReadonlyMap<string, string>;
  loadingFolders: ReadonlySet<string>;
}): string {
  return React.useMemo(
    () =>
      [
        [...loadingFolders].sort().join("|"),
        [...folderErrors]
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([path, error]) => `${path}:${error}`)
          .join("|"),
      ].join("::"),
    [folderErrors, loadingFolders],
  );
}
