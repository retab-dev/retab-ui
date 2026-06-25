"use client";

import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { ViewerBody } from "./viewer-body";
import { ViewerSidebar } from "./viewer-sidebar";
import {
  ViewerSurface,
  ViewerViewport,
  useOptionalViewerSurfaceMeasurement,
} from "./viewer-surface";
import type {
  ViewerBodyProps,
  ViewerSidebarProps,
  ViewerSurfaceProps,
  ViewerViewportProps,
} from "./viewer-types";
import { cn } from "@/lib/utils";

import { Separator } from "./separator";

export type FileViewerBodyProps = ViewerBodyProps;
export type FileViewerFieldSourceProps = React.ComponentProps<"div"> & {
  isActive?: boolean;
  isUnavailable?: boolean;
};
export type FileViewerFieldSourceLabelProps = React.ComponentProps<"span">;
export type FileViewerFieldSourceStatusProps = React.ComponentProps<"span"> &
  VariantProps<typeof fileViewerSourceBadgeVariants>;
export type FileViewerFieldSourceValueProps = React.ComponentProps<"span">;
export type FileViewerLegendProps = React.ComponentProps<"div">;
export type FileViewerSidebarProps = ViewerSidebarProps;
export type FileViewerSidebarContentProps = React.ComponentProps<"div">;
export type FileViewerSidebarSectionProps = React.ComponentProps<"section">;
export type FileViewerSidebarSectionActionProps =
  React.ComponentProps<"button"> & {
    asChild?: boolean;
  };
export type FileViewerSidebarSectionContentProps = React.ComponentProps<"div">;
export type FileViewerSidebarSectionHeaderProps = React.ComponentProps<"div">;
export type FileViewerSidebarSectionTitleProps = React.ComponentProps<"h3">;
export type FileViewerSidebarSeparatorProps = React.ComponentProps<
  typeof Separator
>;
export type FileViewerSurfaceProps = ViewerSurfaceProps;
export type FileViewerSourceActionProps = React.ComponentProps<"button"> & {
  asChild?: boolean;
  showOnHover?: boolean;
} & VariantProps<typeof fileViewerSourceActionVariants>;
export type FileViewerSourceBadgeProps = React.ComponentProps<"span"> &
  VariantProps<typeof fileViewerSourceBadgeVariants>;
export type FileViewerSourceItemProps = React.ComponentProps<"li">;
export type FileViewerSourceListProps = React.ComponentProps<"ul">;
export type FileViewerSourceTriggerProps = React.ComponentProps<"button"> & {
  asChild?: boolean;
  isActive?: boolean;
  isUnavailable?: boolean;
} & VariantProps<typeof fileViewerSourceTriggerVariants>;
export type FileViewerViewportProps = ViewerViewportProps;
export type FileViewerViewportSize = {
  element: HTMLDivElement | null;
  hasMeasured: boolean;
  height: number | null;
  width: number | null;
};

const FileViewerBodyContext = React.createContext(false);

const fileViewerSourceTriggerVariants = cva(
  "peer/source-trigger ring-ring flex w-full min-w-0 items-center gap-2 overflow-hidden rounded-md text-left text-sm outline-hidden transition-[background-color,color,box-shadow] focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 data-[active=true]:font-medium [&>span:last-child]:truncate [&>svg]:size-4 [&>svg]:shrink-0",
  {
    variants: {
      size: {
        default: "h-8 px-2 py-1.5",
        sm: "h-7 px-2 py-1 text-xs",
        lg: "min-h-10 px-2.5 py-2",
      },
      variant: {
        default:
          "hover:bg-accent hover:text-accent-foreground data-[active=true]:bg-accent data-[active=true]:text-accent-foreground",
        ghost:
          "hover:bg-accent hover:text-accent-foreground data-[active=true]:bg-accent/70 data-[active=true]:text-accent-foreground",
        outline:
          "border border-border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground data-[active=true]:border-ring data-[active=true]:bg-accent data-[active=true]:text-accent-foreground",
      },
    },
    defaultVariants: {
      size: "default",
      variant: "default",
    },
  },
);

const fileViewerSourceActionVariants = cva(
  "ring-ring text-muted-foreground hover:bg-accent hover:text-accent-foreground peer-hover/source-trigger:text-accent-foreground absolute right-1 flex aspect-square items-center justify-center rounded-md outline-hidden transition-[background-color,color,opacity,box-shadow] focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 [&>svg]:size-4 [&>svg]:shrink-0",
  {
    variants: {
      size: {
        default: "top-1.5 size-5",
        sm: "top-1 size-5",
        lg: "top-2 size-6",
      },
      variant: {
        ghost: "",
        outline: "border border-border bg-background shadow-xs",
      },
    },
    defaultVariants: {
      size: "default",
      variant: "ghost",
    },
  },
);

const fileViewerSourceBadgeVariants = cva(
  "inline-flex min-w-0 shrink-0 items-center justify-center rounded-md px-1.5 py-0.5 text-xs font-medium tabular-nums",
  {
    variants: {
      tone: {
        default: "bg-primary/10 text-primary",
        destructive: "bg-destructive/10 text-destructive",
        muted: "bg-muted text-muted-foreground",
        success: "bg-emerald-500/10 text-emerald-500",
        warning: "bg-amber-500/10 text-amber-500",
      },
    },
    defaultVariants: {
      tone: "muted",
    },
  },
);

export function FileViewerBody({ className, ...props }: FileViewerBodyProps) {
  return (
    <FileViewerBodyContext.Provider value={true}>
      <ViewerBody
        data-file-viewer-slot="body"
        data-slot="file-viewer-body"
        className={className}
        {...props}
      />
    </FileViewerBodyContext.Provider>
  );
}

export function FileViewerLegend({
  className,
  ...props
}: FileViewerLegendProps) {
  return (
    <div
      data-file-viewer-slot="legend"
      data-slot="file-viewer-legend"
      className={cn("min-w-0 flex-shrink-0 border-b", className)}
      {...props}
    />
  );
}

export function FileViewerSurface({
  className,
  ...props
}: FileViewerSurfaceProps) {
  return (
    <ViewerSurface
      data-file-viewer-slot="surface"
      data-slot="file-viewer-surface"
      className={className}
      {...props}
    />
  );
}

export function useOptionalFileViewerViewportSize(): FileViewerViewportSize | null {
  const measurement = useOptionalViewerSurfaceMeasurement();
  if (!measurement) return null;
  return {
    element: measurement.viewportElement,
    hasMeasured: measurement.hasMeasured,
    height: measurement.viewportHeight,
    width: measurement.viewportWidth,
  };
}

export function useFileViewerViewportSize(): FileViewerViewportSize {
  const size = useOptionalFileViewerViewportSize();
  if (!size) {
    throw new Error(
      "useFileViewerViewportSize must be used within FileViewerSurface.",
    );
  }
  return size;
}

export function FileViewerSidebar({ style, ...props }: FileViewerSidebarProps) {
  const isInsideBody = React.useContext(FileViewerBodyContext);

  if (process.env.NODE_ENV !== "production" && !isInsideBody) {
    throw new Error(
      "FileViewerSidebar must be rendered inside FileViewerBody.",
    );
  }

  return (
    <ViewerSidebar
      data-slot="file-viewer-sidebar"
      namespacedSlot="sidebar"
      namespacedSlotNames={{
        container: "sidebar-container",
        gap: "sidebar-gap",
        inner: "sidebar-inner",
      }}
      slotNames={{
        container: "file-viewer-sidebar-container",
        gap: "file-viewer-sidebar-gap",
        inner: "file-viewer-sidebar-inner",
      }}
      style={
        {
          "--file-viewer-sidebar-collapsed-width": "0px",
          "--file-viewer-sidebar-width": "var(--viewer-sidebar-width)",
          ...style,
        } as React.CSSProperties
      }
      {...props}
    />
  );
}

export function FileViewerSidebarContent({
  className,
  ...props
}: FileViewerSidebarContentProps) {
  return (
    <div
      data-file-viewer-slot="sidebar-content"
      data-slot="file-viewer-sidebar-content"
      className={cn(
        "flex min-h-0 min-w-0 flex-1 flex-col overflow-auto",
        className,
      )}
      {...props}
    />
  );
}

export function FileViewerSidebarSection({
  className,
  ...props
}: FileViewerSidebarSectionProps) {
  return (
    <section
      data-file-viewer-slot="sidebar-section"
      data-slot="file-viewer-sidebar-section"
      className={cn("relative flex w-full min-w-0 flex-col p-3", className)}
      {...props}
    />
  );
}

export function FileViewerSidebarSectionHeader({
  className,
  ...props
}: FileViewerSidebarSectionHeaderProps) {
  return (
    <div
      data-file-viewer-slot="sidebar-section-header"
      data-slot="file-viewer-sidebar-section-header"
      className={cn(
        "flex min-h-8 min-w-0 shrink-0 items-center gap-2",
        className,
      )}
      {...props}
    />
  );
}

export function FileViewerSidebarSectionTitle({
  className,
  ...props
}: FileViewerSidebarSectionTitleProps) {
  return (
    <h3
      data-file-viewer-slot="sidebar-section-title"
      data-slot="file-viewer-sidebar-section-title"
      className={cn(
        "text-muted-foreground min-w-0 flex-1 truncate px-1 text-xs font-medium",
        className,
      )}
      {...props}
    />
  );
}

export function FileViewerSidebarSectionAction({
  asChild = false,
  className,
  type = "button",
  ...props
}: FileViewerSidebarSectionActionProps) {
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      data-file-viewer-slot="sidebar-section-action"
      data-slot="file-viewer-sidebar-section-action"
      type={asChild ? undefined : type}
      className={cn(
        "ring-ring text-muted-foreground hover:bg-accent hover:text-accent-foreground flex size-7 shrink-0 items-center justify-center rounded-md outline-hidden transition-[background-color,color,box-shadow] focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-50 [&>svg]:size-4 [&>svg]:shrink-0",
        className,
      )}
      {...props}
    />
  );
}

export function FileViewerSidebarSectionContent({
  className,
  ...props
}: FileViewerSidebarSectionContentProps) {
  return (
    <div
      data-file-viewer-slot="sidebar-section-content"
      data-slot="file-viewer-sidebar-section-content"
      className={cn("flex min-w-0 flex-col gap-2", className)}
      {...props}
    />
  );
}

export function FileViewerSidebarSeparator({
  className,
  ...props
}: FileViewerSidebarSeparatorProps) {
  return (
    <Separator
      data-file-viewer-slot="sidebar-separator"
      data-slot="file-viewer-sidebar-separator"
      className={cn("mx-3 w-auto", className)}
      {...props}
    />
  );
}

export function FileViewerSourceList({
  className,
  ...props
}: FileViewerSourceListProps) {
  return (
    <ul
      data-file-viewer-slot="source-list"
      data-slot="file-viewer-source-list"
      className={cn("flex w-full min-w-0 flex-col gap-1", className)}
      {...props}
    />
  );
}

export function FileViewerSourceItem({
  className,
  ...props
}: FileViewerSourceItemProps) {
  return (
    <li
      data-file-viewer-slot="source-item"
      data-slot="file-viewer-source-item"
      className={cn("group/source-item relative min-w-0", className)}
      {...props}
    />
  );
}

export function FileViewerSourceTrigger({
  asChild = false,
  className,
  disabled,
  isActive = false,
  isUnavailable = false,
  onClick,
  size,
  type = "button",
  variant,
  ...props
}: FileViewerSourceTriggerProps) {
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      {...props}
      aria-disabled={isUnavailable || props["aria-disabled"]}
      data-active={isActive}
      data-file-viewer-slot="source-trigger"
      data-size={size ?? "default"}
      data-slot="file-viewer-source-trigger"
      data-unavailable={isUnavailable}
      disabled={asChild ? undefined : disabled}
      type={asChild ? undefined : type}
      onClick={(event) => {
        if (isUnavailable) {
          event.preventDefault();
          return;
        }
        onClick?.(event);
      }}
      className={cn(
        fileViewerSourceTriggerVariants({ size, variant }),
        className,
      )}
    />
  );
}

export function FileViewerSourceBadge({
  className,
  tone,
  ...props
}: FileViewerSourceBadgeProps) {
  return (
    <span
      data-file-viewer-slot="source-badge"
      data-slot="file-viewer-source-badge"
      data-tone={tone ?? "muted"}
      className={cn(fileViewerSourceBadgeVariants({ tone }), className)}
      {...props}
    />
  );
}

export function FileViewerSourceAction({
  asChild = false,
  className,
  disabled,
  onClick,
  showOnHover = false,
  size,
  type = "button",
  variant,
  ...props
}: FileViewerSourceActionProps) {
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      data-file-viewer-slot="source-action"
      data-show-on-hover={showOnHover}
      data-size={size ?? "default"}
      data-slot="file-viewer-source-action"
      disabled={asChild ? undefined : disabled}
      type={asChild ? undefined : type}
      onClick={onClick}
      className={cn(
        fileViewerSourceActionVariants({ size, variant }),
        "peer-data-[size=default]/source-trigger:top-1.5 peer-data-[size=lg]/source-trigger:top-2 peer-data-[size=sm]/source-trigger:top-1",
        showOnHover &&
          "group-focus-within/source-item:opacity-100 group-hover/source-item:opacity-100 data-[state=open]:opacity-100 md:opacity-0",
        className,
      )}
      {...props}
    />
  );
}

export function FileViewerFieldSource({
  className,
  isActive = false,
  isUnavailable = false,
  ...props
}: FileViewerFieldSourceProps) {
  return (
    <div
      data-active={isActive}
      data-file-viewer-slot="field-source"
      data-slot="file-viewer-field-source"
      data-unavailable={isUnavailable}
      className={cn(
        "border-border bg-card text-card-foreground flex min-w-0 flex-col gap-1 rounded-md border px-3 py-2 text-sm transition-[background-color,border-color,box-shadow]",
        "data-[active=true]:border-ring data-[active=true]:ring-ring/30 data-[active=true]:ring-2",
        "data-[unavailable=true]:opacity-60",
        className,
      )}
      {...props}
    />
  );
}

export function FileViewerFieldSourceLabel({
  className,
  ...props
}: FileViewerFieldSourceLabelProps) {
  return (
    <span
      data-file-viewer-slot="field-source-label"
      data-slot="file-viewer-field-source-label"
      className={cn(
        "text-muted-foreground min-w-0 truncate text-xs font-medium",
        className,
      )}
      {...props}
    />
  );
}

export function FileViewerFieldSourceValue({
  className,
  ...props
}: FileViewerFieldSourceValueProps) {
  return (
    <span
      data-file-viewer-slot="field-source-value"
      data-slot="file-viewer-field-source-value"
      className={cn("text-foreground min-w-0 truncate text-sm", className)}
      {...props}
    />
  );
}

export function FileViewerFieldSourceStatus({
  className,
  tone,
  ...props
}: FileViewerFieldSourceStatusProps) {
  return (
    <span
      data-file-viewer-slot="field-source-status"
      data-slot="file-viewer-field-source-status"
      data-tone={tone ?? "muted"}
      className={cn(fileViewerSourceBadgeVariants({ tone }), className)}
      {...props}
    />
  );
}

export const FileViewerViewport = React.forwardRef<
  HTMLDivElement,
  FileViewerViewportProps
>(function FileViewerViewport({ style, ...props }, ref) {
  const measurement = useOptionalViewerSurfaceMeasurement();

  if (process.env.NODE_ENV !== "production" && !measurement) {
    throw new Error(
      "FileViewerViewport must be rendered inside FileViewerSurface.",
    );
  }

  return (
    <ViewerViewport
      ref={ref}
      data-file-viewer-slot="viewport"
      data-slot="file-viewer-viewport"
      style={
        {
          ...style,
          ...(measurement?.viewportWidth !== null &&
          measurement?.viewportWidth !== undefined
            ? {
                "--file-viewer-viewport-width": `${measurement.viewportWidth}px`,
              }
            : {}),
          ...(measurement?.viewportHeight !== null &&
          measurement?.viewportHeight !== undefined
            ? {
                "--file-viewer-viewport-height": `${measurement.viewportHeight}px`,
              }
            : {}),
        } as React.CSSProperties
      }
      {...props}
    />
  );
});
