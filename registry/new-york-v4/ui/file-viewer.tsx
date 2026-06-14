"use client"

import * as React from "react"
import { FileText } from "lucide-react"

import {
  createViewerResource,
  type ViewerResource,
} from "@/lib/viewer-resource"
import { cn } from "@/lib/utils"
import { useIsClient } from "@/components/ui/use-is-client"
import { ViewerHeader } from "@/components/ui/viewer"
import { ViewerDownloadButton } from "@/components/ui/viewer-download"

import {
  FileErrorBoundary,
  UnsupportedCard,
  ViewerFallback,
} from "./file-viewer-chrome"
import {
  descriptorResetKey,
  isProseTextDescriptor,
  resolveFileDescriptor,
  type FileCategory,
  type FileDescriptor,
  type FileViewerProps,
} from "./file-viewer-core"
import { CsvDocViewer } from "./file-viewer-csv-viewer"
import { HtmlDocViewer } from "./file-viewer-html-viewer"

export { type FileCategory, type FileViewerProps } from "./file-viewer-core"

export type FileViewerProviderProps = Pick<
  FileViewerProps,
  "as" | "isolateStyles" | "source"
> & {
  children: React.ReactNode
}

export type FileViewerContentProps = Pick<FileViewerProps, "bare" | "className">

export type FileViewerHeaderProps = React.ComponentProps<typeof ViewerHeader> & {
  actions?: React.ReactNode
  showCategory?: boolean
}

type FileViewerContextValue = {
  descriptor: FileDescriptor
  descriptorKey: string
  descriptorSignal: AbortSignal
  isClient: boolean
  isolateStyles: boolean
  resource: ViewerResource
}

const FileViewerContext = React.createContext<FileViewerContextValue | null>(
  null
)

const PdfResourceViewer = React.lazy(() =>
  import("@/components/ui/pdf-viewer").then((m) => ({
    default: m.PdfResourceViewer,
  }))
)
const DocxResourceViewer = React.lazy(() =>
  import("@/components/ui/docx-viewer").then((m) => ({
    default: m.DocxResourceViewer,
  }))
)
const ImageResourceViewer = React.lazy(() =>
  import("@/components/ui/image-viewer").then((m) => ({
    default: m.ImageResourceViewer,
  }))
)
const PptxResourceViewer = React.lazy(() =>
  import("@/components/ui/pptx-viewer").then((m) => ({
    default: m.PptxResourceViewer,
  }))
)
const XlsxResourceViewer = React.lazy(() =>
  import("@/components/ui/xlsx-viewer").then((m) => ({
    default: m.XlsxResourceViewer,
  }))
)
const ProseTextViewer = React.lazy(() =>
  import("@/components/ui/text-viewer-chenglou").then((m) => ({
    default: m.ChenglouTextViewer,
  }))
)
const PretextMarkdownViewer = React.lazy(() =>
  import("@/components/ui/pretext-markdown-viewer").then((m) => ({
    default: m.PretextMarkdownViewer,
  }))
)
const CodeTextViewer = React.lazy(() =>
  import("@/components/ui/code-viewer").then((m) => ({
    default: m.CodeViewer,
  }))
)

const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? React.useLayoutEffect : React.useEffect

function useDescriptorSignal(descriptorKey: string): AbortSignal {
  const controller = React.useMemo(() => {
    void descriptorKey
    return new AbortController()
  }, [descriptorKey])
  const abortTimerRef = React.useRef<{
    controller: AbortController
    timer: ReturnType<typeof setTimeout>
  } | null>(null)

  useIsomorphicLayoutEffect(() => {
    if (abortTimerRef.current?.controller === controller) {
      clearTimeout(abortTimerRef.current.timer)
      abortTimerRef.current = null
    }

    return () => {
      const abortTimer = {
        controller,
        timer: setTimeout(() => {
          controller.abort()
          if (abortTimerRef.current === abortTimer) {
            abortTimerRef.current = null
          }
        }, 0),
      }
      abortTimerRef.current = abortTimer
    }
  }, [controller])

  return controller.signal
}

export function useFileViewer() {
  const context = React.useContext(FileViewerContext)
  if (!context) {
    throw new Error("useFileViewer must be used within FileViewerProvider.")
  }
  return context
}

export function FileViewerProvider({
  as,
  children,
  isolateStyles = false,
  source,
}: FileViewerProviderProps) {
  const isClient = useIsClient()
  const resource = React.useMemo(
    () => createViewerResource(source, as),
    [source, as]
  )
  const descriptor = resolveFileDescriptor({ source, as })
  const descriptorKey = descriptorResetKey(descriptor)
  const descriptorSignal = useDescriptorSignal(descriptorKey)
  const value = React.useMemo<FileViewerContextValue>(
    () => ({
      descriptor,
      descriptorKey,
      descriptorSignal,
      isClient,
      isolateStyles,
      resource,
    }),
    [
      descriptor,
      descriptorKey,
      descriptorSignal,
      isClient,
      isolateStyles,
      resource,
    ]
  )

  return (
    <FileViewerContext.Provider value={value}>
      {children}
    </FileViewerContext.Provider>
  )
}

export function FileViewerContent({
  bare = false,
  className,
}: FileViewerContentProps) {
  const {
    descriptor,
    descriptorKey,
    descriptorSignal,
    isClient,
    isolateStyles,
    resource,
  } = useFileViewer()
  const fallback = (
    <ViewerFallback resource={resource} className={className} bare={bare} />
  )

  if (!isClient) return fallback

  return (
    <FileErrorBoundary
      key={descriptorKey}
      descriptor={descriptor}
      resource={resource}
      className={className}
      resetKey={descriptorKey}
    >
      <React.Suspense fallback={fallback}>
        <FileViewerRoute
          bare={bare}
          className={className}
          descriptor={descriptor}
          descriptorSignal={descriptorSignal}
          isolateStyles={isolateStyles}
          resource={resource}
        />
      </React.Suspense>
    </FileErrorBoundary>
  )
}

export function FileViewerHeader({
  actions,
  children,
  className,
  showCategory = true,
  ...props
}: FileViewerHeaderProps) {
  const { descriptor, resource } = useFileViewer()

  return (
    <ViewerHeader
      className={cn("flex min-h-10 items-center gap-2 px-2", className)}
      {...props}
    >
      {children ?? (
        <>
          <FileText className="size-4 shrink-0 text-muted-foreground" />
          <span
            className="min-w-0 flex-1 truncate text-sm font-medium"
            title={descriptor.displayName}
          >
            {descriptor.displayName}
          </span>
          {showCategory ? (
            <span className="shrink-0 text-xs text-muted-foreground">
              {descriptor.category}
            </span>
          ) : null}
          {actions}
          <ViewerDownloadButton action={resource.originalDownload} />
        </>
      )}
    </ViewerHeader>
  )
}

export function FileViewer({
  as,
  bare,
  className,
  isolateStyles,
  source,
}: FileViewerProps) {
  return (
    <FileViewerProvider as={as} isolateStyles={isolateStyles} source={source}>
      <FileViewerContent bare={bare} className={className} />
    </FileViewerProvider>
  )
}

function FileViewerRoute({
  descriptor,
  className,
  bare = false,
  isolateStyles,
  descriptorSignal,
  resource,
}: FileViewerContentProps & {
  descriptor: FileDescriptor
  descriptorSignal: AbortSignal
  isolateStyles: boolean
  resource: ViewerResource
}) {
  const { category } = descriptor
  const directLoadUrl = resource.content.directUrl ?? undefined
  if (descriptor.source.kind === "text") {
    if (category === "csv") {
      return (
        <CsvDocViewer
          resource={resource}
          className={className}
          bare={bare}
          isolateStyles={isolateStyles}
        />
      )
    }
    if (category === "markdown") {
      return (
        <PretextMarkdownViewer
          source={resource.descriptor.source}
          className={className}
          bare={bare}
        />
      )
    }
    if (category === "html") {
      return (
        <HtmlDocViewer
          resource={resource}
          className={className}
          bare={bare}
          descriptorSignal={descriptorSignal}
        />
      )
    }
    if (category === "text") {
      return renderTextViewer({ descriptor, resource, className, bare })
    }
    return (
      <UnsupportedCard resource={resource} className={className} bare={bare} />
    )
  }

  if (!directLoadUrl) {
    if (category === "pdf" && descriptor.source.kind === "blob") {
      return (
        <PdfResourceViewer
          resource={resource}
          className={className}
          bare={bare}
        />
      )
    }
    if (category === "image" && descriptor.source.kind === "blob") {
      return (
        <ImageResourceViewer
          resource={resource}
          className={className}
          bare={bare}
        />
      )
    }
    if (category === "pptx" && descriptor.source.kind === "blob") {
      return (
        <PptxResourceViewer
          resource={resource}
          className={className}
          bare={bare}
        />
      )
    }
    if (category === "csv" && descriptor.source.kind === "blob") {
      return (
        <CsvDocViewer
          resource={resource}
          className={className}
          bare={bare}
          isolateStyles={isolateStyles}
        />
      )
    }
    if (category === "html" && descriptor.source.kind === "blob") {
      return (
        <HtmlDocViewer
          resource={resource}
          className={className}
          bare={bare}
          descriptorSignal={descriptorSignal}
        />
      )
    }
    if (category === "docx" && descriptor.source.kind === "blob") {
      return (
        <DocxResourceViewer
          resource={resource}
          className={className}
          bare={bare}
        />
      )
    }
    if (category === "xlsx" && descriptor.source.kind === "blob") {
      return (
        <XlsxResourceViewer
          resource={resource}
          className={className}
          bare={bare}
          isolateStyles={isolateStyles}
        />
      )
    }
    if (category === "markdown" && descriptor.source.kind === "blob") {
      return (
        <PretextMarkdownViewer
          source={resource.descriptor.source}
          className={className}
          bare={bare}
        />
      )
    }
    if (category === "text" && descriptor.source.kind === "blob") {
      return renderTextViewer({ descriptor, resource, className, bare })
    }
    return (
      <UnsupportedCard resource={resource} className={className} bare={bare} />
    )
  }

  switch (category) {
    case "pdf":
      return (
        <PdfResourceViewer
          resource={resource}
          className={className}
          bare={bare}
        />
      )
    case "docx":
      return (
        <DocxResourceViewer
          resource={resource}
          className={className}
          bare={bare}
        />
      )
    case "image":
      return (
        <ImageResourceViewer
          resource={resource}
          className={className}
          bare={bare}
        />
      )
    case "pptx":
      return (
        <PptxResourceViewer
          resource={resource}
          className={className}
          bare={bare}
        />
      )
    case "xlsx":
      return (
        <XlsxResourceViewer
          resource={resource}
          className={className}
          bare={bare}
          isolateStyles={isolateStyles}
        />
      )
    case "csv":
      return (
        <CsvDocViewer
          resource={resource}
          className={className}
          bare={bare}
          isolateStyles={isolateStyles}
        />
      )
    case "markdown":
      return (
        <PretextMarkdownViewer
          source={resource.descriptor.source}
          className={className}
          bare={bare}
        />
      )
    case "html":
      return (
        <HtmlDocViewer
          resource={resource}
          className={className}
          bare={bare}
          descriptorSignal={descriptorSignal}
        />
      )
    case "text":
      return renderTextViewer({ descriptor, resource, className, bare })
    default:
      return (
        <UnsupportedCard
          resource={resource}
          className={className}
          bare={bare}
        />
      )
  }
}

function renderTextViewer({
  descriptor,
  resource,
  className,
  bare,
}: {
  descriptor: FileDescriptor
  resource: ViewerResource
  className?: string
  bare: boolean
}) {
  const source = resource.descriptor.source
  if (isProseTextDescriptor(descriptor)) {
    return (
      <ProseTextViewer
        source={source}
        className={className}
        bare={bare}
        mode="text"
      />
    )
  }
  return <CodeTextViewer source={source} className={className} bare={bare} />
}
