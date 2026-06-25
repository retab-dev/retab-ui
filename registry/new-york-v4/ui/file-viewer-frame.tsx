"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

import { useFileViewerContext } from "./file-viewer-context";
import { ViewerRoot } from "./viewer-root";
import type { ViewerRootProps } from "./viewer-types";

export type FileViewerLayout = "fill" | "intrinsic";

export type FileViewerProps = React.ComponentProps<"div"> &
  Pick<
    ViewerRootProps,
    "inlineBreakpoint" | "sidebarCollapsible" | "sidebarSide"
  > & {
    layout?: FileViewerLayout;
    sidebarMode?: ViewerRootProps["mode"];
  };

const FILE_VIEWER_STATE_NAMESPACE = {
  prefix: "file-viewer",
  slots: {
    body: true,
    root: true,
    sidebar: true,
  },
} as const;

export function FileViewer({
  children,
  className,
  inlineBreakpoint,
  layout = "fill",
  sidebarCollapsible,
  sidebarMode,
  sidebarSide,
  ...props
}: FileViewerProps) {
  const context = useFileViewerContext();

  if (!context.isInsideFileViewer) {
    throw new Error("FileViewer must be rendered within FileViewerProvider.");
  }

  return (
    <ViewerRoot
      data-file-viewer="root"
      data-file-viewer-header-mode={context.headerMode}
      data-file-viewer-layout={layout}
      data-file-viewer-resource-category={context.resourceCategory}
      data-file-viewer-slot="root"
      data-slot="file-viewer-root"
      stateNamespace={FILE_VIEWER_STATE_NAMESPACE}
      className={cn(
        "h-full",
        layout === "fill" && "min-h-0 w-full min-w-0 flex-1",
        className,
      )}
      defaultOpen={context.sidebarOpenProps.defaultOpen}
      inlineBreakpoint={inlineBreakpoint}
      mode={sidebarMode}
      onOpenChange={context.sidebarOpenProps.onOpenChange}
      open={context.sidebarOpenProps.open}
      sidebarCollapsible={sidebarCollapsible}
      sidebarSide={sidebarSide}
      {...props}
    >
      {children}
    </ViewerRoot>
  );
}
