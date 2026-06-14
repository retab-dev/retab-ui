"use client"

import * as React from "react"

import type { ViewerSource } from "@/lib/viewer-source"

import type { FileSystemSourceController } from "./file-system-source-controller"
import type { FileSystemFileEntry, FileSystemProps } from "./file-system-types"

export type FileSystemOpenPreviewState =
  | { status: "idle" }
  | { file: FileSystemFileEntry; status: "resolving" }
  | { file: FileSystemFileEntry; source: ViewerSource; status: "open" }
  | { file: FileSystemFileEntry; status: "unavailable" }
  | { error: string; file: FileSystemFileEntry; status: "failed" }

export type FileSystemOpenPreviewController = {
  close: () => void
  open: (file: FileSystemFileEntry) => void
  state: FileSystemOpenPreviewState
}

export function useFileSystemOpenPreviewController({
  onFileOpen,
  resolveFileSource,
}: {
  onFileOpen?: FileSystemProps["onFileOpen"]
  resolveFileSource: FileSystemSourceController["resolveFileSource"]
}): FileSystemOpenPreviewController {
  const [state, setState] = React.useState<FileSystemOpenPreviewState>({
    status: "idle",
  })
  const requestRef = React.useRef<{
    abortController: AbortController
    requestId: number
  } | null>(null)
  const nextRequestId = React.useRef(0)

  const close = React.useCallback(() => {
    requestRef.current?.abortController.abort()
    requestRef.current = null
    setState({ status: "idle" })
  }, [])

  const open = React.useCallback(
    (file: FileSystemFileEntry) => {
      requestRef.current?.abortController.abort()

      const requestId = nextRequestId.current + 1
      nextRequestId.current = requestId

      const abortController = new AbortController()
      requestRef.current = { abortController, requestId }
      setState({ file, status: "resolving" })

      void resolveFileSource(file, abortController.signal)
        .then((source) => {
          if (requestRef.current?.requestId !== requestId) return
          if (abortController.signal.aborted) return

          onFileOpen?.(file, source)

          if (!source) {
            setState({ file, status: "unavailable" })
            return
          }

          setState({ file, source, status: "open" })
        })
        .catch((error: unknown) => {
          if (requestRef.current?.requestId !== requestId) return
          if (abortController.signal.aborted) return

          onFileOpen?.(file, null)
          setState({
            error: fileSystemOpenPreviewErrorMessage(error),
            file,
            status: "failed",
          })
        })
    },
    [onFileOpen, resolveFileSource]
  )

  React.useEffect(() => close, [close])

  return React.useMemo(() => ({ close, open, state }), [close, open, state])
}

function fileSystemOpenPreviewErrorMessage(error: unknown) {
  return error instanceof Error && error.message
    ? error.message
    : "Unable to open file."
}
