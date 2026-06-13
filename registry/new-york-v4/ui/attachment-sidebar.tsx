"use client"

import * as React from "react"
import { Paperclip } from "lucide-react"

import { cn } from "@/lib/utils"
import { createViewerResource } from "@/lib/viewer-resource"
import type { ViewerSource } from "@/lib/viewer-source"

import { formatFileSize } from "./file-size-format"
import { FileThumbnail } from "./file-thumbnail"
import {
  EmbeddedSidebarProvider,
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "./sidebar"

export interface AttachmentSidebarItem {
  id: string
  source: ViewerSource
  label?: string
  description?: string
  size?: number | null
  isDisabled?: boolean
}

export interface AttachmentSidebarProps {
  items: readonly AttachmentSidebarItem[]
  selectedId?: string | null
  onSelect?: (id: string) => void
  header?: React.ReactNode
  emptyLabel?: React.ReactNode
  children?: React.ReactNode
  side?: "left" | "right"
  width?: string
  className?: string
  providerClassName?: string
}

/**
 * File attachment navigator built from the shared Sidebar primitives. It owns
 * attachment/file row semantics, while callers own the selected id and any
 * domain-specific rows they pass as children.
 */
export function AttachmentSidebar({
  items,
  selectedId,
  onSelect,
  header,
  emptyLabel = "No attachments.",
  children,
  side = "right",
  width = "18rem",
  className,
  providerClassName,
}: AttachmentSidebarProps) {
  return (
    <EmbeddedSidebarProvider className={providerClassName} width={width}>
      <Sidebar
        side={side}
        collapsible="none"
        data-slot="attachment-sidebar"
        className={cn(
          "h-full w-full border-sidebar-border bg-sidebar",
          side === "right" ? "md:border-l" : "md:border-r",
          className
        )}
      >
        <SidebarHeader className="border-b px-3 py-2">
          {header ?? <DefaultAttachmentSidebarHeader count={items.length} />}
        </SidebarHeader>
        <SidebarContent>
          {children ? (
            <>
              {children}
              <SidebarSeparator />
            </>
          ) : null}
          <SidebarGroup className="min-h-0 flex-1">
            <SidebarGroupLabel>Attachments</SidebarGroupLabel>
            <SidebarGroupContent>
              {items.length === 0 ? (
                <p className="px-2 py-3 text-xs text-sidebar-foreground/70">
                  {emptyLabel}
                </p>
              ) : (
                <SidebarMenu className="gap-2">
                  {items.map((item) => (
                    <AttachmentSidebarMenuItem
                      key={item.id}
                      item={item}
                      isSelected={selectedId === item.id}
                      onSelect={onSelect}
                    />
                  ))}
                </SidebarMenu>
              )}
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>
    </EmbeddedSidebarProvider>
  )
}

function DefaultAttachmentSidebarHeader({ count }: { count: number }) {
  return (
    <div className="flex h-6 items-center gap-2 text-xs font-medium text-sidebar-foreground">
      <Paperclip className="size-3.5 text-sidebar-accent-foreground" />
      <span>
        {count} attachment{count === 1 ? "" : "s"}
      </span>
    </div>
  )
}

function AttachmentSidebarMenuItem({
  item,
  isSelected,
  onSelect,
}: {
  item: AttachmentSidebarItem
  isSelected: boolean
  onSelect: ((id: string) => void) | undefined
}) {
  const resource = createViewerResource(item.source)
  const label = item.label?.trim() || resource.fileName
  const meta =
    item.description?.trim() ||
    (item.size != null
      ? formatFileSize(item.size)
      : (resource.mimeType ?? resource.descriptor.category))

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        aria-current={isSelected ? "page" : undefined}
        aria-label={`${label} ${meta}`}
        className="h-auto items-start gap-2 rounded-lg border border-transparent p-2 data-[active=true]:border-sidebar-border"
        disabled={item.isDisabled}
        isActive={isSelected}
        onClick={() => onSelect?.(item.id)}
      >
        <FileThumbnail
          source={item.source}
          presentation="decorative"
          className="h-16 w-12 flex-shrink-0"
          previewAspectRatio={3 / 4}
        />
        <span className="flex min-w-0 flex-1 flex-col gap-1 pt-0.5">
          <span className="truncate text-sm font-medium">{label}</span>
          <span className="truncate text-xs text-sidebar-foreground/70">
            {meta}
          </span>
        </span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}
