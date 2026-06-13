"use client"

import * as React from "react"

import { PlainTextViewerShell } from "./plain-text-viewer-shell"
import { ChenglouTextViewerContent } from "./text-viewer-chenglou-content"
import { TextViewerFallback } from "./text-viewer-chrome"
import type { TextViewerHandle, TextViewerProps } from "./text-viewer-types"

export const ChenglouTextViewer = React.forwardRef<
  TextViewerHandle,
  TextViewerProps
>(function ChenglouTextViewer(props, ref) {
  return (
    <PlainTextViewerShell
      props={props}
      forwardedRef={ref}
      clientFallbackPolicy="always"
      Fallback={TextViewerFallback}
      Content={ChenglouTextViewerContent}
    />
  )
})
