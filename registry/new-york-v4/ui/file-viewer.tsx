"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import {
  ViewerBody,
  ViewerHeader,
  ViewerRoot,
  ViewerSidebar,
  ViewerSidebarTrigger,
  ViewerSurface,
  type ViewerRootProps,
  type ViewerSidebarProps,
  type ViewerSidebarTriggerProps,
  type ViewerSurfaceProps,
} from "@/components/ui/viewer"

import { type FileViewerProps as FileViewerCoreProps } from "./file-viewer-core"
import { FileViewerDocument } from "./file-viewer-document"
import {
  FileViewerProvider,
  useFileViewerContext,
  useFileViewerControlsState,
} from "./file-viewer-internal"
import { ViewerControls } from "./viewer-controls"

export {
  detectCategory,
  type FileCategory,
  type ViewerSource,
} from "./file-viewer-core"
export {
  FileViewerDocument,
  type FileViewerDocumentProps,
} from "./file-viewer-document"
export { useFileViewerResource } from "./file-viewer-internal"

type FileViewerRootOptions = Pick<
  ViewerRootProps,
  | "defaultOpen"
  | "inlineBreakpoint"
  | "mode"
  | "onOpenChange"
  | "open"
  | "sidebarCollapsible"
  | "sidebarSide"
>

export type FileViewerRootProps = FileViewerCoreProps &
  FileViewerRootOptions & {
    bare?: false
    children?: React.ReactNode
  }

export type FileViewerStandaloneProps = FileViewerCoreProps & {
  bare: true
  children?: never
}

export type FileViewerProps = FileViewerRootProps | FileViewerStandaloneProps

export type FileViewerHeaderProps = React.ComponentProps<typeof ViewerHeader>

export type FileViewerTitleProps = React.ComponentProps<"div">

export type FileViewerMetaProps = React.ComponentProps<"span">

export type FileViewerControlsProps = Omit<
  React.ComponentProps<typeof ViewerControls>,
  | "downloads"
  | "loading"
  | "position"
  | "rotate"
  | "subtitle"
  | "title"
  | "zoom"
>

export type FileViewerBodyProps = React.ComponentProps<typeof ViewerBody>
export type FileViewerSidebarProps = ViewerSidebarProps
export type FileViewerSurfaceProps = ViewerSurfaceProps
export type FileViewerSidebarTriggerProps = ViewerSidebarTriggerProps

export function FileViewerHeader({
  children,
  className,
  ...props
}: FileViewerHeaderProps) {
  return (
    <ViewerHeader
      data-slot="file-viewer-header"
      className={cn(
        "flex min-h-10 flex-wrap items-center gap-2 px-2 py-1 sm:flex-nowrap sm:py-0",
        className
      )}
      {...props}
    >
      {children ?? (
        <>
          <FileViewerTitle />
          <FileViewerMeta />
          <FileViewerControls />
        </>
      )}
    </ViewerHeader>
  )
}

export function FileViewerTitle({ className, ...props }: FileViewerTitleProps) {
  const { descriptor } = useFileViewerContext()

  return (
    <div
      data-slot="file-viewer-title"
      className={cn("flex min-w-0 shrink items-center gap-2", className)}
      {...props}
    >
      <span
        className="min-w-0 truncate text-sm font-medium"
        title={descriptor.displayName}
      >
        {descriptor.displayName}
      </span>
    </div>
  )
}

export function FileViewerMeta({ className, ...props }: FileViewerMetaProps) {
  const { descriptor, resource } = useFileViewerContext()
  const meta = resource.mimeType || descriptor.mimeType || descriptor.category

  if (!meta) return null

  return (
    <span
      data-slot="file-viewer-meta"
      className={cn(
        "shrink-0 truncate text-xs text-muted-foreground",
        className
      )}
      {...props}
    >
      {meta}
    </span>
  )
}

export function FileViewerControls({
  className,
  extra,
  ...props
}: FileViewerControlsProps) {
  const { resource } = useFileViewerContext()
  const controlsState = useFileViewerControlsState()
  const downloads = controlsState?.downloads ?? [resource.originalDownload]

  return (
    <ViewerControls
      {...props}
      data-slot="file-viewer-controls"
      className={cn(
        "ml-0 h-auto min-w-0 basis-full border-b-0 bg-transparent px-0 sm:ml-auto sm:basis-auto",
        className
      )}
      downloads={downloads}
      extra={extra ?? controlsState?.extra}
      loading={controlsState?.loading ?? false}
      position={controlsState?.position ?? null}
      rotate={controlsState?.rotate ?? null}
      zoom={controlsState?.zoom ?? null}
    />
  )
}

export function FileViewerBody({ className, ...props }: FileViewerBodyProps) {
  return (
    <ViewerBody data-slot="file-viewer-body" className={className} {...props} />
  )
}

export function FileViewerSidebar(props: FileViewerSidebarProps) {
  return <ViewerSidebar data-slot="file-viewer-sidebar" {...props} />
}

export function FileViewerSurface({
  className,
  ...props
}: FileViewerSurfaceProps) {
  return (
    <ViewerSurface
      data-slot="file-viewer-surface"
      className={className}
      {...props}
    />
  )
}

export function FileViewerSidebarTrigger({
  className,
  ...props
}: FileViewerSidebarTriggerProps) {
  return (
    <ViewerSidebarTrigger
      data-slot="file-viewer-sidebar-trigger"
      className={className}
      {...props}
    />
  )
}

export function FileViewer(props: FileViewerProps) {
  if (props.bare) {
    const { as, className, isolateStyles, source } = props
    return (
      <FileViewerProvider
        as={as}
        documentChrome="standalone"
        isolateStyles={isolateStyles}
        source={source}
      >
        <FileViewerDocument className={className} />
      </FileViewerProvider>
    )
  }

  const {
    as,
    children,
    className,
    defaultOpen,
    inlineBreakpoint,
    isolateStyles,
    mode,
    onOpenChange,
    open,
    sidebarCollapsible,
    sidebarSide,
    source,
  } = props

  return (
    <FileViewerProvider as={as} isolateStyles={isolateStyles} source={source}>
      <ViewerRoot
        className={cn("h-full", className)}
        defaultOpen={defaultOpen}
        inlineBreakpoint={inlineBreakpoint}
        mode={mode}
        onOpenChange={onOpenChange}
        open={open}
        sidebarCollapsible={sidebarCollapsible}
        sidebarSide={sidebarSide}
      >
        {children ?? (
          <>
            <FileViewerHeader />
            <FileViewerBody>
              <FileViewerSurface>
                <FileViewerDocument />
              </FileViewerSurface>
            </FileViewerBody>
          </>
        )}
      </ViewerRoot>
    </FileViewerProvider>
  )
}
