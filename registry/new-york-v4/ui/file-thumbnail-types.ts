import type * as React from "react"

import type { ViewerErrorInfo } from "@/lib/viewer-errors"
import type { FileCategory, ViewerSource } from "@/lib/viewer-source"
import type { ThumbnailAnchor } from "@/components/document-thumbnail/types"

import type {
  FileThumbnailFrameProps,
  FileThumbnailState,
  ThumbnailFile,
} from "./file-thumbnail-frame-types"

export type {
  FileThumbnailFrameProps,
  FileThumbnailState,
  ThumbnailFile,
} from "./file-thumbnail-frame-types"

export type FileThumbnailSource = ViewerSource | File

export interface FileThumbnailProps
  extends Omit<FileThumbnailFrameProps, "file" | "onError"> {
  /** A browser File renders through the document thumbnail pipeline. */
  file?: ThumbnailFile | File
  /** URL, Blob/File, or inline text source for generated document thumbnails. */
  source?: FileThumbnailSource
  /** Override auto-detection when name or MIME type is missing or wrong. */
  as?: FileCategory
  /** Corner pinned when rendered document content overflows the frame. */
  anchor?: ThumbnailAnchor
  /** Change to retry a failed generated thumbnail for the same source. */
  retryKey?: React.Key
  /** Receives document renderer failures with canonical viewer error info. */
  onError?: (error: unknown, info: ViewerErrorInfo) => void
}
