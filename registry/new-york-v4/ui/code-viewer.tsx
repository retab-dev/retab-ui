"use client"

import * as React from "react"

import { CodeViewerFallback } from "./code-viewer-chrome"
import { CodeViewerContent } from "./code-viewer-content"
import type { CodeViewerHandle, CodeViewerProps } from "./code-viewer-types"
import { PlainTextViewerShell } from "./plain-text-viewer-shell"

export type {
  CodeDocumentSource,
  TextLineRange,
  CodeViewerHandle,
  CodeViewerProps,
} from "./code-viewer-types"

export const CodeViewer = React.forwardRef<CodeViewerHandle, CodeViewerProps>(
  function CodeViewer(props, ref) {
    return (
      <PlainTextViewerShell
        props={props}
        forwardedRef={ref}
        clientFallbackPolicy="non-inline-source"
        Fallback={CodeViewerFallback}
        Content={CodeViewerContent}
      />
    )
  }
)
