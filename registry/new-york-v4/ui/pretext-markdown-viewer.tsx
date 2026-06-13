"use client"

import * as React from "react"

import { PlainTextViewerShell } from "./plain-text-viewer-shell"
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
    <PlainTextViewerShell
      props={props}
      forwardedRef={ref}
      clientFallbackPolicy="always"
      Fallback={TextViewerFallback}
      Content={PretextMarkdownViewerContent}
    />
  )
})
