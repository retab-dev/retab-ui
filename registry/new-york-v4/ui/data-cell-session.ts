"use client";

import * as React from "react";

import type {
  DataCellCommitValue,
  DataCellValueMeta,
} from "@/registry/new-york-v4/ui/data-cell-types";

type DataCellSessionCommitOptions = {
  endEditing?: boolean;
  markFinished?: boolean;
  shouldCommit?: () => boolean;
};

type DataCellSessionEndOptions = {
  markFinished?: boolean;
};

export type DataCellSessionCommit = (
  value: DataCellCommitValue,
  meta: DataCellValueMeta,
  options?: DataCellSessionCommitOptions,
) => void;

export type DataCellPrimitiveSession = {
  commit: DataCellSessionCommit;
  cancel: () => void;
  end: (options?: DataCellSessionEndOptions) => void;
  reset: () => void;
};

export function useDataCellPrimitiveSession({
  onCommit,
  onEditingEnd,
}: {
  onCommit?: (value: DataCellCommitValue, meta: DataCellValueMeta) => void;
  onEditingEnd?: () => void;
}): DataCellPrimitiveSession {
  const didFinishRef = React.useRef(false);

  const reset = React.useCallback(() => {
    didFinishRef.current = false;
  }, []);

  const end = React.useCallback(
    ({ markFinished = true }: DataCellSessionEndOptions = {}) => {
      if (didFinishRef.current) return;
      if (markFinished) didFinishRef.current = true;
      onEditingEnd?.();
    },
    [onEditingEnd],
  );

  const commit = React.useCallback<DataCellSessionCommit>(
    (
      value,
      meta,
      {
        endEditing = true,
        markFinished = true,
        shouldCommit,
      }: DataCellSessionCommitOptions = {},
    ) => {
      if (didFinishRef.current) return;
      if (shouldCommit && !shouldCommit()) return;
      if (markFinished) didFinishRef.current = true;
      onCommit?.(value, meta);
      if (endEditing) onEditingEnd?.();
    },
    [onCommit, onEditingEnd],
  );

  const cancel = React.useCallback(() => {
    end();
  }, [end]);

  return {
    commit,
    cancel,
    end,
    reset,
  };
}
