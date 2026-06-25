"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

import {
  ViewerHeader,
  ViewerSidebarTrigger,
  type ViewerSidebarTriggerProps,
} from "./viewer";
import { useFileViewerControlsState } from "./file-viewer-controls-context";
import { useFileViewerRequiredResourceState } from "./file-viewer-resource-state";
import { useFileViewerContext } from "./file-viewer-context";
import { ViewerControls } from "./viewer-controls";
import { ViewerHeaderOutlet } from "./viewer-header-outlet";

export type FileViewerHeaderProps = React.ComponentProps<typeof ViewerHeader>;
export type FileViewerHeaderStartProps = React.ComponentProps<"div">;
export type FileViewerHeaderEndProps = React.ComponentProps<"div">;
export type FileViewerIdentityProps = React.ComponentProps<"div"> & {
  meta?: "hidden" | "responsive" | "visible";
};
export type FileViewerToolbarProps = Omit<
  React.ComponentProps<typeof ViewerControls>,
  | "downloads"
  | "loading"
  | "position"
  | "rotate"
  | "subtitle"
  | "title"
  | "zoom"
>;
export type FileViewerSidebarTriggerProps = ViewerSidebarTriggerProps;

export function FileViewerHeader({
  children,
  className,
  ...props
}: FileViewerHeaderProps) {
  const { hasHeaderOutlets, headerMode } = useFileViewerContext();
  const content = children ?? (
    <>
      <FileViewerHeaderStart>
        <FileViewerIdentity />
      </FileViewerHeaderStart>
      <FileViewerHeaderEnd>
        <FileViewerToolbar />
      </FileViewerHeaderEnd>
    </>
  );

  if (headerMode === "outlets" && hasHeaderOutlets) {
    return <>{content}</>;
  }

  return (
    <ViewerHeader
      data-file-viewer-slot="header"
      data-slot="file-viewer-header"
      className={cn(
        "flex min-h-10 flex-wrap items-center gap-2 px-2 py-1 sm:flex-nowrap sm:py-0",
        className,
      )}
      {...props}
    >
      {content}
    </ViewerHeader>
  );
}

export function FileViewerHeaderStart({
  children,
  className,
  ...props
}: FileViewerHeaderStartProps) {
  const { hasHeaderOutlets, headerMode } = useFileViewerContext();
  const content = (
    <div
      data-file-viewer-slot="header-start"
      data-slot="file-viewer-header-start"
      className={cn("flex min-w-0 flex-1 items-center gap-2", className)}
      {...props}
    >
      {children}
    </div>
  );

  if (headerMode === "outlets" && hasHeaderOutlets) {
    return <ViewerHeaderOutlet name="identity">{content}</ViewerHeaderOutlet>;
  }

  return content;
}

export function FileViewerHeaderEnd({
  children,
  className,
  ...props
}: FileViewerHeaderEndProps) {
  const { hasHeaderOutlets, headerMode } = useFileViewerContext();
  const content = (
    <div
      data-file-viewer-slot="header-end"
      data-slot="file-viewer-header-end"
      className={cn("ms-auto flex shrink-0 items-center gap-1", className)}
      {...props}
    >
      {children}
    </div>
  );

  if (headerMode === "outlets" && hasHeaderOutlets) {
    return <ViewerHeaderOutlet name="toolbar">{content}</ViewerHeaderOutlet>;
  }

  return content;
}

export function FileViewerIdentity({
  className,
  meta = "responsive",
  ...props
}: FileViewerIdentityProps) {
  const { descriptor, resource } = useFileViewerRequiredResourceState();
  const metaText =
    resource.mimeType || descriptor.mimeType || descriptor.category;
  const shouldShowMeta = meta !== "hidden" && Boolean(metaText);

  return (
    <div
      data-file-viewer-slot="identity"
      data-slot="file-viewer-identity"
      className={cn("flex min-w-0 items-baseline gap-2", className)}
      {...props}
    >
      <span
        className="text-foreground min-w-0 truncate text-[13px] leading-5 font-medium"
        title={descriptor.displayName}
      >
        {descriptor.displayName}
      </span>
      {shouldShowMeta ? (
        <span
          className={cn(
            "text-muted-foreground min-w-0 shrink truncate text-xs",
            meta === "responsive" && "hidden sm:inline",
          )}
        >
          {metaText}
        </span>
      ) : null}
    </div>
  );
}

export function FileViewerToolbar({
  className,
  extra,
  ...props
}: FileViewerToolbarProps) {
  const { resource } = useFileViewerRequiredResourceState();
  const controlsState = useFileViewerControlsState();
  const downloads = controlsState?.downloads ?? [resource.originalDownload];

  return (
    <ViewerControls
      {...props}
      data-file-viewer-controls={controlsState ? "ready" : "idle"}
      data-file-viewer-slot="toolbar"
      data-slot="file-viewer-toolbar"
      className={cn("h-8 min-w-0 border-b-0 bg-transparent px-0", className)}
      downloads={downloads}
      extra={extra ?? controlsState?.extra}
      loading={controlsState?.loading ?? false}
      position={controlsState?.position ?? null}
      rotate={controlsState?.rotate ?? null}
      zoom={controlsState?.zoom ?? null}
    />
  );
}

export function FileViewerSidebarTrigger({
  className,
  ...props
}: FileViewerSidebarTriggerProps) {
  return (
    <ViewerSidebarTrigger
      data-file-viewer-slot="sidebar-trigger"
      data-slot="file-viewer-sidebar-trigger"
      className={className}
      {...props}
    />
  );
}
