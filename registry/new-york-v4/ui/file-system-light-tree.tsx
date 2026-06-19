"use client";

/* eslint-disable no-restricted-syntax -- TODO(no-useEffect): existing direct React effect usage; migrate to useMountEffect or a Rule 1-5 replacement. */

import * as React from "react";
import { FileTree as PierreFileTree, useFileTree } from "@pierre/trees/react";

export type FileSystemLightTreeProps = Omit<
  React.ComponentProps<typeof PierreFileTree>,
  "model"
> & {
  onSelectedPathsChange: (selectedPaths: string[]) => void;
  paths: string[];
  selectedPaths: string[];
};

export function FileSystemLightTree({
  onSelectedPathsChange,
  paths,
  selectedPaths,
  ...props
}: FileSystemLightTreeProps) {
  const onSelectedPathsChangeRef = React.useRef(onSelectedPathsChange);

  React.useEffect(() => {
    onSelectedPathsChangeRef.current = onSelectedPathsChange;
  }, [onSelectedPathsChange]);

  const { model } = useFileTree({
    flattenEmptyDirectories: false,
    icons: { colored: false, set: "complete" },
    initialExpansion: "open",
    initialSelectedPaths: selectedPaths,
    itemHeight: 32,
    onSelectionChange: (nextSelectedPaths) => {
      onSelectedPathsChangeRef.current([...nextSelectedPaths]);
    },
    overscan: 12,
    paths,
    search: false,
    stickyFolders: false,
  });

  React.useEffect(() => {
    model.resetPaths(paths);
  }, [model, paths]);

  React.useEffect(() => {
    const selectedPathSet = new Set(selectedPaths);

    for (const path of model.getSelectedPaths()) {
      if (!selectedPathSet.has(path)) {
        model.getItem(path)?.deselect();
      }
    }
    for (const path of selectedPathSet) {
      if (!model.getSelectedPaths().includes(path)) {
        model.getItem(path)?.select();
      }
    }
  }, [model, selectedPaths]);

  return <PierreFileTree {...props} model={model} />;
}
