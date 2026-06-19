"use client";

import * as React from "react";

import { cn } from "@/lib/utils";
import { ViewerHeader, ViewerSidebarTrigger } from "@/components/ui/viewer";

import { EditViewerControls } from "./edit-viewer-controls";
import type { EditViewerMode, EditViewerStatus } from "./edit-viewer-types";

export type EditViewerHeaderViewProps = React.ComponentProps<
  typeof ViewerHeader
> & {
  hasFieldPanel: boolean;
  mode: EditViewerMode | null;
  modes: readonly EditViewerMode[];
  onModeChange: (mode: EditViewerMode) => void;
  status: Exclude<EditViewerStatus, { state: "idle" }> | null;
};

export function EditViewerHeaderView({
  hasFieldPanel,
  mode,
  modes,
  onModeChange,
  status,
  className,
  ...props
}: EditViewerHeaderViewProps) {
  if (modes.length === 0) return null;

  return (
    <ViewerHeader
      className={cn("bg-background flex h-11 items-center px-2", className)}
      {...props}
    >
      <div className="flex h-full min-w-0 items-center gap-2">
        {hasFieldPanel ? <ViewerSidebarTrigger /> : null}
        <EditViewerControls
          modes={modes}
          mode={mode}
          onModeChange={onModeChange}
          status={status}
        />
      </div>
    </ViewerHeader>
  );
}
