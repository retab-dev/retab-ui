"use client";

import * as React from "react";
import { FileTree as PierreFileTree, useFileTree } from "@pierre/trees/react";
import { useKeyedMountEffect } from "@/hooks/use-keyed-mount-effect";
import { joinEffectKey } from "@/lib/effect-key";

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

  useKeyedMountEffect(joinEffectKey([onSelectedPathsChange]), () => {
    onSelectedPathsChangeRef.current = onSelectedPathsChange;
  });

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

  useKeyedMountEffect(joinEffectKey([model, paths]), () => {
    model.resetPaths(paths);
  });

  useKeyedMountEffect(joinEffectKey([model, selectedPaths]), () => {
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
  });

  return <PierreFileTree {...props} model={model} />;
}
