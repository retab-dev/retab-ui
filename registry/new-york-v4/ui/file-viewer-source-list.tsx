"use client";

import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { Slot } from "radix-ui";

import { cn } from "@/lib/utils";

export type FileViewerFieldSourceProps = React.ComponentProps<"div"> & {
  isActive?: boolean;
  isUnavailable?: boolean;
};
export type FileViewerFieldSourceLabelProps = React.ComponentProps<"span">;
export type FileViewerFieldSourceStatusProps = React.ComponentProps<"span"> &
  VariantProps<typeof fileViewerSourceBadgeVariants>;
export type FileViewerFieldSourceValueProps = React.ComponentProps<"span">;
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

export function FileViewerSourceList({
  className,
  ...props
}: FileViewerSourceListProps) {
  return (
    <ul
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
  const Comp = asChild ? Slot.Root : "button";

  return (
    <Comp
      {...props}
      aria-disabled={isUnavailable || props["aria-disabled"]}
      data-active={isActive}
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
  const Comp = asChild ? Slot.Root : "button";

  return (
    <Comp
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
      data-slot="file-viewer-field-source-status"
      data-tone={tone ?? "muted"}
      className={cn(fileViewerSourceBadgeVariants({ tone }), className)}
      {...props}
    />
  );
}
