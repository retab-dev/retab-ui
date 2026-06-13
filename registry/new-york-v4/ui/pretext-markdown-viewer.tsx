"use client"

import * as React from "react"

import { PlainTextViewerFrame } from "./plain-text-viewer-frame"
import { PretextMarkdownViewerContent } from "./pretext-markdown-viewer-content"
import { TextViewerFallback } from "./text-viewer-chrome"
import type { TextViewerHandle, TextViewerProps } from "./text-viewer-types"

export type {
  TextDocumentSource,
  TextLineRange,
  TextViewerHandle,
  TextViewerProps,
} from "./text-viewer-types"

export const PretextMarkdownViewer = React.forwardRef<
  TextViewerHandle,
  TextViewerProps
>(function PretextMarkdownViewer(props, ref) {
  return (
    <PlainTextViewerFrame
      props={props}
      forwardedRef={ref}
      clientFallbackPolicy="always"
      Fallback={TextViewerFallback}
      Content={PretextMarkdownViewerContent}
    />
  )
})
