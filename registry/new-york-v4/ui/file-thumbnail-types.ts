import type * as React from "react"

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
