"use client"

import * as React from "react"

import { PlainTextViewerShell } from "./plain-text-viewer-shell"
import { TextViewerFallback } from "./text-viewer-chrome"
import { TextViewerContent } from "./text-viewer-content"
import type { TextViewerHandle, TextViewerProps } from "./text-viewer-types"

export type {
  TextDocumentSource,
  TextLineRange,
  TextViewerHandle,
  TextViewerProps,
} from "./text-viewer-types"

export const TextViewer = React.forwardRef<TextViewerHandle, TextViewerProps>(
  function TextViewer(props, ref) {
    return (
      <PlainTextViewerShell
        props={props}
        forwardedRef={ref}
        clientFallbackPolicy="always"
        Fallback={TextViewerFallback}
        Content={TextViewerContent}
      />
    )
  }
)
