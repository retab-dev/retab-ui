"use client";

import * as React from "react";
import type { FileTreeSortComparator } from "@pierre/trees";

import type { PierrePath } from "./file-system-pierre-input";

export type FileSystemPierreOrder = {
  compare: FileTreeSortComparator;
  reset: (pierrePaths: readonly PierrePath[]) => void;
};

export function useFileSystemPierreOrder(
  pierrePaths: readonly PierrePath[],
): FileSystemPierreOrder {
  const orderRef = React.useRef(createPierreInputOrder(pierrePaths));
  const compare = React.useCallback<FileTreeSortComparator>(
    (left, right) =>
      comparePierreInputOrder(orderRef.current, left.path, right.path),
    [],
  );
  const reset = React.useCallback((pierrePaths: readonly PierrePath[]) => {
    orderRef.current = createPierreInputOrder(pierrePaths);
  }, []);

  return React.useMemo(() => ({ compare, reset }), [compare, reset]);
}

function createPierreInputOrder(
  pierrePaths: readonly PierrePath[],
): Map<PierrePath, number> {
  return new Map(pierrePaths.map((path, index) => [path, index]));
}

function comparePierreInputOrder(
  order: ReadonlyMap<PierrePath, number>,
  leftPath: PierrePath,
  rightPath: PierrePath,
) {
  const leftIndex = order.get(leftPath) ?? Number.MAX_SAFE_INTEGER;
  const rightIndex = order.get(rightPath) ?? Number.MAX_SAFE_INTEGER;

  if (leftIndex !== rightIndex) {
    return leftIndex - rightIndex;
  }

  return leftPath.localeCompare(rightPath, undefined, {
    numeric: true,
    sensitivity: "base",
  });
}
