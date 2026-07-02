"use client";

import * as React from "react";

import {
  DEFAULT_FILE_VIEWER_SIDEBAR_WIDTH,
  type FileViewerSidebarCollapsible,
  type FileViewerSidebarRegistration,
  type FileViewerSidebarSide,
} from "./file-viewer-context";

export type FileViewerSidebarRegistrationController = {
  canToggleSidebar: boolean;
  effectiveCollapsible: FileViewerSidebarCollapsible;
  registerSidebar: (registration: FileViewerSidebarRegistration) => () => void;
  side: FileViewerSidebarSide;
  sidebarId: string;
  sidebarWidth: string;
  sidebarWidthPixels: number;
};

// The mounted FileViewerSidebar is the single source of sidebar configuration
// (collapsible, side, width); the shell only holds neutral defaults until one
// registers. No sidebar registered means nothing to toggle and no motion, so
// no fallback width measurement is needed.
export function useFileViewerSidebarRegistration({
  fallbackSidebarId,
}: {
  fallbackSidebarId: string;
}): FileViewerSidebarRegistrationController {
  const [sidebarRegistration, setSidebarRegistration] =
    React.useState<FileViewerSidebarRegistration | null>(null);
  const effectiveCollapsible = sidebarRegistration?.collapsible ?? "offcanvas";
  const side = sidebarRegistration?.side ?? "left";
  const sidebarId = sidebarRegistration?.id ?? fallbackSidebarId;
  const sidebarWidth =
    sidebarRegistration?.width ?? DEFAULT_FILE_VIEWER_SIDEBAR_WIDTH;
  const sidebarWidthPixels = sidebarRegistration?.widthPixels ?? 0;
  const canToggleSidebar =
    sidebarRegistration !== null && effectiveCollapsible !== "none";

  const registerSidebar = React.useCallback(
    (registration: FileViewerSidebarRegistration) => {
      setSidebarRegistration(registration);
      return () => {
        setSidebarRegistration((current) =>
          current?.id === registration.id ? null : current,
        );
      };
    },
    [],
  );

  return React.useMemo(
    () => ({
      canToggleSidebar,
      effectiveCollapsible,
      registerSidebar,
      side,
      sidebarId,
      sidebarWidth,
      sidebarWidthPixels,
    }),
    [
      canToggleSidebar,
      effectiveCollapsible,
      registerSidebar,
      side,
      sidebarId,
      sidebarWidth,
      sidebarWidthPixels,
    ],
  );
}
