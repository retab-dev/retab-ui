"use client";

import * as React from "react";

import type { FileSystemDispatch } from "./file-system-kernel-selectors";
import type { FileSystemQueryState, FileSystemView } from "./file-system-types";
import { useKeyedMountEffect } from "@/hooks/use-keyed-mount-effect";
import { joinEffectKey } from "@/lib/effect-key";

export function useFileSystemControlledProps({
  dispatch,
  path,
  query,
  selectedPath,
  view,
}: {
  dispatch: FileSystemDispatch;
  path?: string;
  query?: FileSystemQueryState;
  selectedPath?: string | null;
  view?: FileSystemView;
}) {
  useKeyedMountEffect(joinEffectKey([dispatch, path]), () => {
    if (path !== undefined) {
      dispatch({ path, source: "controlled-prop", type: "path.changed" });
    }
  });

  useKeyedMountEffect(joinEffectKey([dispatch, query]), () => {
    if (query !== undefined) {
      dispatch({ query, source: "controlled-prop", type: "query.changed" });
    }
  });

  useKeyedMountEffect(joinEffectKey([dispatch, view]), () => {
    if (view !== undefined) {
      dispatch({ source: "controlled-prop", type: "view.changed", view });
    }
  });

  useKeyedMountEffect(joinEffectKey([dispatch, selectedPath]), () => {
    if (selectedPath !== undefined) {
      dispatch({
        path: selectedPath,
        source: "controlled-prop",
        type: "entry.selected",
      });
    }
  });
}
