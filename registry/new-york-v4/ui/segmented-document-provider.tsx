"use client"

import * as React from "react"

import type { SegmentedDocumentModel } from "./segmented-document-model"
import {
  useSegmentViewportController,
  type SegmentedDocumentViewport,
} from "./use-segment-viewport-controller"

export type SegmentedDocumentContextValue = {
  model: SegmentedDocumentModel
  viewport: SegmentedDocumentViewport
}

const SegmentedDocumentContext =
  React.createContext<SegmentedDocumentContextValue | null>(null)

export function SegmentedDocumentProvider({
  children,
  model,
}: {
  children: React.ReactNode
  model: SegmentedDocumentModel
}) {
  const viewport = useSegmentViewportController({ segments: model.segments })
  const value = React.useMemo<SegmentedDocumentContextValue>(
    () => ({ model, viewport }),
    [model, viewport]
  )

  return (
    <SegmentedDocumentContext.Provider value={value}>
      {children}
    </SegmentedDocumentContext.Provider>
  )
}

export function useSegmentedDocument(): SegmentedDocumentContextValue {
  const context = React.useContext(SegmentedDocumentContext)
  if (!context) {
    throw new Error(
      "useSegmentedDocument must be used within SegmentedDocumentProvider."
    )
  }
  return context
}

export function useSegmentedDocumentViewport(): SegmentedDocumentViewport {
  return useSegmentedDocument().viewport
}

export function useSegmentedDocumentModel(): SegmentedDocumentModel {
  return useSegmentedDocument().model
}
