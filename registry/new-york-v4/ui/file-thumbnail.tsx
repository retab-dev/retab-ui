"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

export interface ThumbnailFile {
  name: string
  type: string
}

export type FileThumbnailState = "loading" | "loaded" | "error"

export interface FileThumbnailProps extends Omit<
  React.ComponentPropsWithoutRef<"div">,
  "children"
> {
  /** The file being previewed. A browser `File` works too. */
  file: ThumbnailFile | File
  /** Aspect ratio of the preview frame (width / height). Defaults to 3 / 4. */
  previewAspectRatio?: number
  previewClassName?: string
  /** Custom React preview (e.g. a rendered PDF page). Takes priority over the image. */
  previewContent?: React.ReactNode
  /** Externally generated thumbnail image URL. */
  previewImageUrl?: string | null
  /** Called when the browser image preview fails to load. */
  onPreviewError?: () => void
  /** Explicit preview lifecycle. */
  state?: FileThumbnailState
}

/**
 * A compact preview shell for a file: a fixed-ratio frame with a loading
 * shimmer, a fade-in once the preview loads, and a muted fallback surface when
 * there is no preview or it fails to load.
 *
 * It does not parse documents or pull in any renderer packages — generate the
 * thumbnail with whatever viewer stack you already use and pass it in through
 * `previewImageUrl` or `previewContent`.
 */
export function FileThumbnail({
  file,
  className,
  previewAspectRatio,
  previewClassName,
  previewContent,
  previewImageUrl,
  onPreviewError,
  state,
  style,
  ...props
}: FileThumbnailProps) {
  const extension = getExtension(file)
  const hasRenderableContent = hasRenderablePreviewContent(previewContent)
  const resolvedState = resolveFileThumbnailState({
    explicitState: state,
    hasPreview: hasRenderableContent || Boolean(previewImageUrl),
  })

  return (
    <div
      {...props}
      data-slot="file-thumbnail"
      className={cn(
        "relative overflow-hidden rounded-md border bg-muted text-muted-foreground",
        className
      )}
      style={{
        ...style,
        aspectRatio: style?.aspectRatio ?? String(previewAspectRatio ?? 3 / 4),
      }}
    >
      {resolvedState === "loading" ? (
        <FileThumbnailShimmer />
      ) : resolvedState === "error" ? (
        <Fallback extension={extension} />
      ) : hasRenderableContent ? (
        <div className={cn("absolute inset-0", previewClassName)}>
          {previewContent}
        </div>
      ) : previewImageUrl ? (
        // Keying by URL remounts the image when the source changes, which
        // restarts the loading/fade state without an effect.
        <ThumbnailImage
          key={previewImageUrl}
          url={previewImageUrl}
          alt={file.name}
          className={previewClassName}
          fallback={<Fallback extension={extension} />}
          onError={onPreviewError}
        />
      ) : (
        <Fallback extension={extension} />
      )}
    </div>
  )
}

export function resolveFileThumbnailState({
  explicitState,
  hasPreview,
}: {
  explicitState?: FileThumbnailState
  hasPreview: boolean
}): FileThumbnailState {
  if (explicitState) return explicitState
  return hasPreview ? "loaded" : "error"
}

export function hasRenderablePreviewContent(value: React.ReactNode): boolean {
  return value !== null && value !== undefined && value !== false
}

function ThumbnailImage({
  url,
  alt,
  className,
  fallback,
  onError,
}: {
  url: string
  alt: string
  className?: string
  fallback: React.ReactNode
  onError?: () => void
}) {
  const [loaded, setLoaded] = React.useState(false)
  const [failed, setFailed] = React.useState(false)
  const didReportErrorRef = React.useRef(false)

  const reportError = React.useCallback(() => {
    if (didReportErrorRef.current) return
    didReportErrorRef.current = true
    onError?.()
  }, [onError])

  // A cached image can finish loading before React attaches `onLoad`, so the
  // event never fires and the fade-in would stay stuck at opacity 0. Catch that
  // case from the ref by checking `complete` once the element mounts.
  const imgRef = React.useCallback(
    (img: HTMLImageElement | null) => {
      if (!img) return
      if (img.complete) {
        if (img.naturalWidth > 0) setLoaded(true)
        else {
          setFailed(true)
          reportError()
        }
      }
    },
    [reportError]
  )

  if (failed) return <>{fallback}</>

  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={imgRef}
        src={url}
        alt={alt}
        loading="lazy"
        decoding="async"
        onLoad={() => setLoaded(true)}
        onError={() => {
          setFailed(true)
          reportError()
        }}
        className={cn(
          "absolute inset-0 size-full object-cover transition-opacity duration-300",
          loaded ? "opacity-100" : "opacity-0",
          className
        )}
      />
      {loaded ? null : <FileThumbnailShimmer />}
    </>
  )
}

export function FileThumbnailShimmer() {
  const highlightRef = React.useRef<HTMLDivElement | null>(null)
  const prefersReducedMotion = usePrefersReducedMotion()

  React.useEffect(() => {
    const highlight = highlightRef.current
    if (!highlight || prefersReducedMotion || !highlight.animate) return

    const animation = highlight.animate(
      [{ backgroundPosition: "200% 0" }, { backgroundPosition: "-200% 0" }],
      {
        duration: 1600,
        iterations: Infinity,
        easing: "linear",
      }
    )

    return () => animation.cancel()
  }, [prefersReducedMotion])

  // A diagonal highlight sweeps across the muted surface. The animation and
  // timing are local to this element so the component never needs global CSS.
  return (
    <div
      aria-hidden
      data-slot="file-thumbnail-shimmer"
      className="absolute inset-0 overflow-hidden bg-muted"
    >
      <div
        ref={highlightRef}
        data-slot="file-thumbnail-shimmer-highlight"
        className="absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(120deg, transparent 35%, var(--skeleton-highlight, color-mix(in oklab, var(--background) 85%, transparent)) 50%, transparent 65%)",
          backgroundSize: "200% 100%",
          backgroundRepeat: "no-repeat",
          backgroundPosition: prefersReducedMotion ? "50% 0" : "200% 0",
        }}
      />
    </div>
  )
}

function usePrefersReducedMotion(): boolean {
  return React.useSyncExternalStore(
    subscribeToReducedMotion,
    getReducedMotionSnapshot,
    () => false
  )
}

function subscribeToReducedMotion(onChange: () => void) {
  if (typeof window === "undefined" || !window.matchMedia) return () => {}

  const query = window.matchMedia("(prefers-reduced-motion: reduce)")
  query.addEventListener("change", onChange)
  return () => query.removeEventListener("change", onChange)
}

function getReducedMotionSnapshot() {
  if (typeof window === "undefined" || !window.matchMedia) return false

  return window.matchMedia("(prefers-reduced-motion: reduce)").matches
}

function Fallback({ extension }: { extension: string | null }) {
  return (
    <div
      data-slot="file-thumbnail-fallback"
      className="absolute inset-0 flex flex-col items-center justify-center gap-1.5"
    >
      <svg
        viewBox="0 0 24 24"
        className="size-1/3 opacity-40"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        aria-hidden
      >
        <path d="M6 2.5h8L19 7v13.5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-17a1 1 0 0 1 1-1Z" />
        <path d="M14 2.5V7h5" />
      </svg>
      {extension ? (
        <span className="max-w-[80%] truncate text-[0.625rem] font-medium tracking-wide uppercase opacity-70">
          {extension}
        </span>
      ) : null}
    </div>
  )
}

function getExtension(file: ThumbnailFile | File): string | null {
  const fromName = file.name?.includes(".")
    ? (file.name.split(".").pop() ?? null)
    : null
  if (fromName) return fromName.toLowerCase()
  const subtype = mimeSubtypeToExtension(file.type)
  return subtype ? subtype.toLowerCase() : null
}

function mimeSubtypeToExtension(type: string | undefined): string | null {
  if (!type) return null
  const normalized = type.toLowerCase().split(";")[0].trim()
  if (normalized in MIME_EXTENSION) return MIME_EXTENSION[normalized]
  const subtype = normalized.split("/").pop()
  return subtype || null
}

const MIME_EXTENSION: Record<string, string> = {
  "application/pdf": "pdf",
  "application/vnd.ms-excel": "xls",
  "application/vnd.ms-powerpoint": "ppt",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation":
    "pptx",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    "docx",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/tiff": "tiff",
  "text/csv": "csv",
  "text/html": "html",
  "text/markdown": "md",
  "text/plain": "txt",
}
