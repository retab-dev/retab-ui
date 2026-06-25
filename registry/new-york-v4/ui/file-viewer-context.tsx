"use client";

import * as React from "react";

import type { FileCategory } from "@/lib/viewer-source";

import { useOptionalViewerSidebar } from "./viewer-root";
import type { ViewerSidebarStateValue } from "./viewer-types";

export type FileViewerHeaderMode = "inline" | "outlets";

export type FileViewerSidebarOpenProps = {
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  open?: boolean;
};

export type FileViewerContextValue = {
  headerMode: FileViewerHeaderMode;
  hasHeaderOutlets: boolean;
  isInsideFileViewer: boolean;
  resourceCategory: FileCategory;
  sidebarOpenProps: FileViewerSidebarOpenProps;
};

export const FileViewerContext = React.createContext<FileViewerContextValue>({
  headerMode: "inline",
  hasHeaderOutlets: false,
  isInsideFileViewer: false,
  resourceCategory: "unsupported",
  sidebarOpenProps: {},
});

export type FileViewerSidebarStateValue = Pick<
  ViewerSidebarStateValue,
  | "state"
  | "open"
  | "setOpen"
  | "toggleSidebar"
  | "canToggleSidebar"
  | "mode"
  | "side"
>;

export function useFileViewerContext() {
  return React.useContext(FileViewerContext);
}

export function useFileViewerSidebar(): FileViewerSidebarStateValue {
  const fileViewerContext = React.useContext(FileViewerContext);
  const sidebarContext = useOptionalViewerSidebar();

  if (!fileViewerContext.isInsideFileViewer || !sidebarContext) {
    throw new Error("useFileViewerSidebar must be used within FileViewer.");
  }

  return sidebarContext;
}
