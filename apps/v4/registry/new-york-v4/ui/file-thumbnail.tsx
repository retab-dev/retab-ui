"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

export interface ThumbnailFile {
  name: string
  type: string
}

export interface FileThumbnailProps {
  /** The file being previewed. A browser `File` works too. */
  file: ThumbnailFile | File
  className?: string
  /** Aspect ratio of the preview frame (width / height). Defaults to 3 / 4. */
  previewAspectRatio?: number
  previewClassName?: string
  /** Custom React preview (e.g. a rendered PDF page). Takes priority over the image. */
  previewContent?: React.ReactNode
  /** Externally generated thumbnail image URL. */
  previewImageUrl?: string | null
  /** Your thumbnail generator is still producing the preview. */
  isLoading?: boolean
  /** Your thumbnail generator failed; show the fallback surface. */
  hasError?: boolean
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
  isLoading = false,
  hasError = false,
}: FileThumbnailProps) {
  const extension = getExtension(file)

  return (
    <div
      data-slot="file-thumbnail"
      className={cn(
        "bg-muted text-muted-foreground relative overflow-hidden rounded-md border",
        className
      )}
      style={{ aspectRatio: String(previewAspectRatio ?? 3 / 4) }}
    >
      {isLoading ? (
        <Shimmer />
      ) : previewContent ? (
        <div className={cn("absolute inset-0", previewClassName)}>
          {previewContent}
        </div>
      ) : previewImageUrl && !hasError ? (
        // Keying by URL remounts the image when the source changes, which
        // restarts the loading/fade state without an effect.
        <ThumbnailImage
          key={previewImageUrl}
          url={previewImageUrl}
          alt={file.name}
          className={previewClassName}
          fallback={<Fallback extension={extension} />}
        />
      ) : (
        <Fallback extension={extension} />
      )}
    </div>
  )
}

function ThumbnailImage({
  url,
  alt,
  className,
  fallback,
}: {
  url: string
  alt: string
  className?: string
  fallback: React.ReactNode
}) {
  const [loaded, setLoaded] = React.useState(false)
  const [failed, setFailed] = React.useState(false)

  // A cached image can finish loading before React attaches `onLoad`, so the
  // event never fires and the fade-in would stay stuck at opacity 0. Catch that
  // case from the ref by checking `complete` once the element mounts.
  const imgRef = React.useCallback((img: HTMLImageElement | null) => {
    if (!img) return
    if (img.complete) {
      if (img.naturalWidth > 0) setLoaded(true)
      else setFailed(true)
    }
  }, [])

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
        onError={() => setFailed(true)}
        className={cn(
          "absolute inset-0 size-full object-cover transition-opacity duration-300",
          loaded ? "opacity-100" : "opacity-0",
          className
        )}
      />
      {loaded ? null : <Shimmer />}
    </>
  )
}

function Shimmer() {
  return (
    <div
      aria-hidden
      data-slot="file-thumbnail-shimmer"
      className="bg-muted absolute inset-0 animate-pulse"
    >
      <div className="from-muted via-muted-foreground/10 to-muted absolute inset-0 -translate-x-full animate-[file-thumbnail-shimmer_1.5s_infinite] bg-gradient-to-r" />
      <style>{`@keyframes file-thumbnail-shimmer{100%{transform:translateX(100%)}}`}</style>
    </div>
  )
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
        <span className="text-[0.625rem] font-medium tracking-wide uppercase opacity-70">
          {extension}
        </span>
      ) : null}
    </div>
  )
}

function getExtension(file: ThumbnailFile | File): string | null {
  const fromName = file.name?.includes(".")
    ? file.name.split(".").pop() ?? null
    : null
  if (fromName) return fromName.toLowerCase()
  const subtype = file.type?.split("/").pop()
  return subtype ? subtype.toLowerCase() : null
}
