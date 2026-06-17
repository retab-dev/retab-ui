"use client"

import * as React from "react"

import {
  createViewerResource,
  type ViewerResource,
} from "@/lib/viewer-resource"
import { useIsClient } from "@/components/ui/use-is-client"

import {
  descriptorResetKey,
  type FileDescriptor,
  type FileViewerDocumentChrome,
  type FileViewerProps as FileViewerCoreProps,
} from "./file-viewer-core"
import {
  ViewerControlsRegistrationProvider,
  type ViewerControlsState,
} from "./viewer-controls"

type FileViewerProviderProps = Pick<
  FileViewerCoreProps,
  "as" | "isolateStyles" | "source"
> & {
  children: React.ReactNode
  documentChrome?: FileViewerDocumentChrome
}

type FileViewerContextValue = {
  descriptor: FileDescriptor
  descriptorKey: string
  descriptorSignal: AbortSignal
  documentChrome: FileViewerDocumentChrome
  isClient: boolean
  isolateStyles: boolean
  resource: ViewerResource
  controlsState: ViewerControlsState | null
  setControlsState: (state: ViewerControlsState | null) => void
}

const FileViewerContext = React.createContext<FileViewerContextValue | null>(
  null
)

const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? React.useLayoutEffect : React.useEffect

// Per-descriptor cancellation signal. Aborting is deferred a macrotask so a
// keyed remount (or StrictMode's mount/unmount/mount) can cancel the pending
// abort and keep reusing the shared resource request instead of tearing it down
// and immediately refetching. Powers HtmlFileContent's external-cancellation
// contract (see html-viewer-edge-cases: abort mid-load).
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

export function useFileViewerContext() {
  const context = React.useContext(FileViewerContext)
  if (!context) {
    throw new Error("File viewer parts must be used within FileViewer.")
  }
  return context
}

export function useOptionalFileViewerResource(): ViewerResource | null {
  return React.useContext(FileViewerContext)?.resource ?? null
}

export function useFileViewerResource(): ViewerResource {
  const resource = useOptionalFileViewerResource()
  if (!resource) {
    throw new Error("useFileViewerResource must be used within FileViewer.")
  }
  return resource
}

export function FileViewerProvider({
  as,
  children,
  documentChrome = "shell",
  isolateStyles = false,
  source,
}: FileViewerProviderProps) {
  const isClient = useIsClient()
  const [controlsState, setControlsState] =
    React.useState<ViewerControlsState | null>(null)
  const handleControlsChange = React.useCallback(
    (state: ViewerControlsState | null) => {
      setControlsState(state)
    },
    []
  )
  const resource = React.useMemo(
    () => createViewerResource(source, as),
    [source, as]
  )
  // createViewerResource already resolved this descriptor; reuse it instead of
  // recomputing. The interned resource is referentially stable across renders,
  // so the context value below stays stable too (a fresh resolve would mint a
  // new object every render and defeat the useMemo).
  const descriptor = resource.descriptor
  const descriptorKey = descriptorResetKey(descriptor)
  const descriptorSignal = useDescriptorSignal(descriptorKey)
  const value = React.useMemo<FileViewerContextValue>(
    () => ({
      descriptor,
      descriptorKey,
      descriptorSignal,
      documentChrome,
      isClient,
      isolateStyles,
      resource,
      setControlsState: handleControlsChange,
      controlsState,
    }),
    [
      descriptor,
      descriptorKey,
      descriptorSignal,
      documentChrome,
      handleControlsChange,
      isClient,
      isolateStyles,
      resource,
      controlsState,
    ]
  )

  return (
    <FileViewerContext.Provider value={value}>
      <ViewerControlsRegistrationProvider
        onControlsChange={handleControlsChange}
      >
        {children}
      </ViewerControlsRegistrationProvider>
    </FileViewerContext.Provider>
  )
}
