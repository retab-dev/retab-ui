"use client"

import * as React from "react"

import { PlainTextViewerFrame } from "./plain-text-viewer-frame"
import { PretextMarkdownGreenfieldContent } from "./pretext-markdown-greenfield-content"
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
      clientFallbackPolicy="non-inline-source"
      Fallback={TextViewerFallback}
      Content={PretextMarkdownGreenfieldContent}
    />
  )
})
