"use client"

import * as React from "react"

import type { PdfDocumentViewportControls } from "./pdf-viewer-types"

type PdfDocumentViewportRegistration = (
  controls: PdfDocumentViewportControls | null
) => void

const PdfDocumentViewportRegistrationContext =
  React.createContext<PdfDocumentViewportRegistration | null>(null)

export function PdfDocumentViewportRegistrationProvider({
  children,
  onViewportControlsChange,
}: {
  children: React.ReactNode
  onViewportControlsChange: PdfDocumentViewportRegistration
}) {
  return (
    <PdfDocumentViewportRegistrationContext.Provider
      value={onViewportControlsChange}
    >
      {children}
    </PdfDocumentViewportRegistrationContext.Provider>
  )
}

export function usePdfDocumentViewportRegistration(): PdfDocumentViewportRegistration | null {
  return React.useContext(PdfDocumentViewportRegistrationContext)
}
