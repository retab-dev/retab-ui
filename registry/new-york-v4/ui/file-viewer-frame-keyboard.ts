"use client";

import * as React from "react";

import type { FileViewerElementRegistry } from "./file-viewer-elements";
import {
  isFileViewerActiveElementInsideShell,
  shouldCloseFileViewerSidebarOnEscape,
} from "./file-viewer-keyboard";

export function useFileViewerFrameKeyboard({
  canToggleSidebar,
  closeSidebar,
  elementRegistry,
  isSidebarInteractive,
  viewerShellElement,
}: {
  canToggleSidebar: boolean;
  closeSidebar: () => void;
  elementRegistry: FileViewerElementRegistry;
  isSidebarInteractive: boolean;
  viewerShellElement: HTMLDivElement | null;
}) {
  React.useLayoutEffect(() => {
    const ownerDocument = viewerShellElement?.ownerDocument;
    if (!ownerDocument) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        !shouldCloseFileViewerSidebarOnEscape({
          canToggleSidebar,
          event,
          isSidebarInteractive,
        })
      ) {
        return;
      }

      if (
        !isFileViewerActiveElementInsideShell({
          activeElement: ownerDocument.activeElement,
          viewerShellElement: elementRegistry.getElements().viewerShellElement,
        })
      ) {
        return;
      }

      event.preventDefault();
      closeSidebar();
    };

    ownerDocument.addEventListener("keydown", handleKeyDown);
    return () => ownerDocument.removeEventListener("keydown", handleKeyDown);
  }, [
    canToggleSidebar,
    closeSidebar,
    elementRegistry,
    isSidebarInteractive,
    viewerShellElement,
  ]);
}
