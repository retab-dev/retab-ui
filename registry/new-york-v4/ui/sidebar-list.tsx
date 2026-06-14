"use client"

import * as React from "react"
import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"

import { cn } from "@/lib/utils"
import { Separator } from "@/components/ui/separator"

import {
  sidebarRowButtonVariants,
  type SidebarRowButtonVariantProps,
} from "./sidebar-row"

function getSidebarListButtonType({
  defaultElement = "button",
  render,
}: {
  defaultElement?: "a" | "button"
  render: unknown
}): React.ButtonHTMLAttributes<HTMLButtonElement>["type"] | undefined {
  if (
    (!render && defaultElement === "button") ||
    (React.isValidElement(render) && render.type === "button")
  ) {
    return "button"
  }

  return undefined
}

function getSidebarListRender(
  render: useRender.RenderProp | undefined
): useRender.RenderProp | undefined {
  if (typeof render !== "function") return render

  return (
    props: React.HTMLAttributes<HTMLElement>,
    state: Record<string, unknown>
  ): React.ReactElement<unknown> => {
    const element = render(props, state)

    if (
      React.isValidElement<React.ButtonHTMLAttributes<HTMLButtonElement>>(
        element
      ) &&
      element.type === "button" &&
      element.props.type == null
    ) {
      return React.cloneElement(element, { type: "button" })
    }

    return element
  }
}

export function SidebarListRoot({
  className,
  width,
  style,
  ...props
}: React.ComponentProps<"div"> & {
  width?: string
}): React.ReactElement {
  return (
    <div
      className={cn(
        "flex h-full min-h-0 w-(--sidebar-width) flex-col bg-sidebar text-sidebar-foreground",
        className
      )}
      data-sidebar-list=""
      data-slot="sidebar-list-root"
      style={
        {
          "--sidebar-width": width,
          ...style,
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export function SidebarListHeader({
  className,
  ...props
}: React.ComponentProps<"div">): React.ReactElement {
  return (
    <div
      className={cn("flex flex-col gap-2 p-2", className)}
      data-slot="sidebar-list-header"
      {...props}
    />
  )
}

export function SidebarListContent({
  className,
  ...props
}: React.ComponentProps<"div">): React.ReactElement {
  return (
    <div
      className={cn(
        "flex min-h-0 flex-1 flex-col gap-2 overflow-auto",
        className
      )}
      data-slot="sidebar-list-content"
      {...props}
    />
  )
}

export function SidebarListGroup({
  className,
  ...props
}: React.ComponentProps<"div">): React.ReactElement {
  return (
    <div
      className={cn("relative flex min-w-0 flex-col p-2", className)}
      data-slot="sidebar-list-group"
      {...props}
    />
  )
}

export function SidebarListGroupLabel({
  className,
  ...props
}: React.ComponentProps<"div">): React.ReactElement {
  return (
    <div
      className={cn(
        "flex h-8 shrink-0 items-center rounded-md px-2 text-xs font-medium text-sidebar-foreground/70 ring-sidebar-ring outline-hidden transition-[margin,opacity] duration-200 ease-linear focus-visible:ring-2 [&>svg]:size-4 [&>svg]:shrink-0",
        className
      )}
      data-slot="sidebar-list-group-label"
      {...props}
    />
  )
}

export function SidebarListGroupContent({
  className,
  ...props
}: React.ComponentProps<"div">): React.ReactElement {
  return (
    <div
      className={cn("w-full text-sm", className)}
      data-slot="sidebar-list-group-content"
      {...props}
    />
  )
}

export function SidebarListMenu({
  className,
  ...props
}: React.ComponentProps<"ul">): React.ReactElement {
  return (
    <ul
      className={cn("flex w-full min-w-0 flex-col gap-1", className)}
      data-slot="sidebar-list-menu"
      {...props}
    />
  )
}

export function SidebarListMenuItem({
  className,
  ...props
}: React.ComponentProps<"li">): React.ReactElement {
  return (
    <li
      className={cn("group/menu-item relative", className)}
      data-slot="sidebar-list-menu-item"
      {...props}
    />
  )
}

export function SidebarListButton({
  isActive = false,
  variant = "default",
  size = "default",
  className,
  render,
  asChild = false,
  children,
  ...props
}: useRender.ComponentProps<"button"> & {
  isActive?: boolean
  asChild?: boolean
} & SidebarRowButtonVariantProps): React.ReactElement {
  const renderValue =
    render ??
    (asChild && React.isValidElement(children)
      ? (children as React.ReactElement<Record<string, unknown>>)
      : undefined)

  const defaultProps = {
    children: asChild && React.isValidElement(children) ? undefined : children,
    className: cn(sidebarRowButtonVariants({ size, variant }), className),
    "data-active": isActive,
    "data-size": size,
    "data-slot": "sidebar-list-button",
    type: getSidebarListButtonType({ render: renderValue }),
  }

  return useRender({
    defaultTagName: "button",
    props: mergeProps<"button">(defaultProps, props),
    render: getSidebarListRender(renderValue),
  })
}

export function SidebarListSeparator({
  className,
  ...props
}: React.ComponentProps<typeof Separator>): React.ReactElement {
  return (
    <Separator
      className={cn("mx-2 w-auto bg-sidebar-border", className)}
      data-slot="sidebar-list-separator"
      {...props}
    />
  )
}
