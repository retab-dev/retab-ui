"use client"

import * as React from "react"

import type { ViewerResource } from "@/lib/viewer-resource"

import { PlainTextViewerFrame } from "./plain-text-viewer-frame"
import { TextViewerFallback } from "./text-viewer-chrome"
import { TextViewerContent } from "./text-viewer-content"
import type { TextViewerHandle, TextViewerProps } from "./text-viewer-types"

export type {
  TextDocumentSource,
  TextLineRange,
  TextViewerHandle,
  TextViewerProps,
} from "./text-viewer-types"

export type TextResourceContentProps = Omit<TextViewerProps, "source"> & {
  resource: ViewerResource
}

export type TextViewerProviderProps = {
  children: React.ReactNode
  resource: ViewerResource
}

export type TextViewerDocumentProps = Omit<TextResourceContentProps, "resource">

export const TextViewer = React.forwardRef<TextViewerHandle, TextViewerProps>(
  function TextViewer(props, ref) {
    return (
      <PlainTextViewerFrame
        props={props}
        forwardedRef={ref}
        clientFallbackPolicy="always"
        Fallback={TextViewerFallback}
        Content={TextViewerContent}
      />
    )
  }
)

const TextViewerResourceContext = React.createContext<ViewerResource | null>(
  null
)

export function TextViewerProvider({
  children,
  resource,
}: TextViewerProviderProps) {
  return (
    <TextViewerResourceContext.Provider value={resource}>
      {children}
    </TextViewerResourceContext.Provider>
  )
}

function useTextViewerResource(): ViewerResource {
  const resource = React.useContext(TextViewerResourceContext)
  if (!resource) {
    throw new Error(
      "TextViewerDocument must be used within TextViewerProvider."
    )
  }
  return resource
}

export const TextViewerDocument = React.forwardRef<
  TextViewerHandle,
  TextViewerDocumentProps
>(function TextViewerDocument(props, ref) {
  const resource = useTextViewerResource()
  return <TextResourceContent {...props} ref={ref} resource={resource} />
})

export const TextResourceContent = React.forwardRef<
  TextViewerHandle,
  TextResourceContentProps
>(function TextResourceContent({ resource, ...props }, ref) {
  return (
    <PlainTextViewerFrame
      props={props}
      resource={resource}
      forwardedRef={ref}
      clientFallbackPolicy="always"
      Fallback={TextViewerFallback}
      Content={TextViewerContent}
    />
  )
})
