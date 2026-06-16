"use client"

import * as React from "react"

import {
  createViewerResource,
  type ViewerResource,
} from "@/lib/viewer-resource"
import { useIsClient } from "@/components/ui/use-is-client"

import {
  descriptorResetKey,
  resolveFileDescriptor,
  type FileDescriptor,
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
}

type FileViewerContextValue = {
  descriptor: FileDescriptor
  descriptorKey: string
  descriptorSignal: AbortSignal
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
      setControlsState: handleControlsChange,
      controlsState,
    }),
    [
      descriptor,
      descriptorKey,
      descriptorSignal,
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
