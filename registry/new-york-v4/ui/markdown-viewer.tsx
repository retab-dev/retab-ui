"use client"

import * as React from "react"

import {
  MarkdownGreenfieldContent,
  type MarkdownViewerProps,
} from "./markdown-greenfield-content"
import { PlainTextViewerFrame } from "./plain-text-viewer-frame"
import { TextViewerFallback } from "./text-viewer-chrome"
import type { TextViewerHandle } from "./text-viewer-types"

export type { MarkdownViewerProps } from "./markdown-greenfield-content"
export type {
  TextDocumentSource,
  TextLineRange,
  TextViewerHandle,
  TextViewerProps,
} from "./text-viewer-types"

export const MarkdownViewer = React.forwardRef<
  TextViewerHandle,
  MarkdownViewerProps
>(function MarkdownViewer(props, ref) {
  return (
    <PlainTextViewerFrame
      props={props}
      forwardedRef={ref}
      clientFallbackPolicy="non-inline-source"
      Fallback={TextViewerFallback}
      Content={MarkdownGreenfieldContent}
    />
  )
})
