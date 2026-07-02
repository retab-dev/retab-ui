"use client";

import * as React from "react";

import type {
  FileViewerSidebarCollapsible,
  FileViewerSidebarOpenProps,
} from "./file-viewer-context";

export type FileViewerSidebarOpenController = {
  getSidebarRequestedOpen: () => boolean;
  isSidebarRequestedOpen: boolean;
  setSidebarRequestedOpen: (isSidebarRequestedOpen: boolean) => void;
};

// Bridges the controlled/uncontrolled `open` prop pair to real React state, so
// every toggle re-renders the tree and the declarative writers (data
// attributes, inert/aria, overlay translate classes) stay current.
export function useFileViewerSidebarOpenController({
  collapsible,
  defaultOpen,
  onOpenChange,
  open,
}: FileViewerSidebarOpenProps & {
  collapsible: FileViewerSidebarCollapsible;
}): FileViewerSidebarOpenController {
  const isControlled = open !== undefined;
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(
    defaultOpen ?? false,
  );
  const isSidebarRequestedOpen =
    collapsible === "none" ? true : (open ?? uncontrolledOpen);
  const openRef = React.useRef(isSidebarRequestedOpen);

  React.useLayoutEffect(() => {
    openRef.current = isSidebarRequestedOpen;
  }, [isSidebarRequestedOpen]);

  const getSidebarRequestedOpen = React.useCallback(() => openRef.current, []);

  const setSidebarRequestedOpen = React.useCallback(
    (nextIsSidebarRequestedOpen: boolean) => {
      openRef.current = nextIsSidebarRequestedOpen;
      if (!isControlled) {
        setUncontrolledOpen(nextIsSidebarRequestedOpen);
      }
      onOpenChange?.(nextIsSidebarRequestedOpen);
    },
    [isControlled, onOpenChange],
  );

  return React.useMemo(
    () => ({
      getSidebarRequestedOpen,
      isSidebarRequestedOpen,
      setSidebarRequestedOpen,
    }),
    [getSidebarRequestedOpen, isSidebarRequestedOpen, setSidebarRequestedOpen],
  );
}
