import {
  isResourceError,
  isViewerFormatError,
  isViewerStateError,
  ViewerFormatError,
} from "@/lib/viewer-errors"

export function toFileViewerTextError(error: unknown): Error {
  if (
    isResourceError(error) ||
    isViewerFormatError(error) ||
    isViewerStateError(error)
  ) {
    return error
  }
  return new ViewerFormatError({
    format: "text",
    kind: "load_failed",
    message: "Failed to load text preview.",
    cause: error,
  })
}
