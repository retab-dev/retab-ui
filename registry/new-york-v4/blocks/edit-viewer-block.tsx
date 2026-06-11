"use client"

import * as React from "react"

import type { FormField } from "@/components/viewers/lib/edit-types"
import { EditViewer } from "@/components/viewers/edit/edit-viewer"
import { PdfViewer } from "@/components/ui/pdf-viewer"
import editSample from "@/components/viewers/sample-data/edit.json"

const PDF_URL = "/samples/fidelity-edit/fidelity_original.pdf"

// A template-fill of the Fidelity "Bank Wire Authorization" form: 29 detected
// form fields across 3 pages, each with a normalized bbox and an inferred value.
const EDIT_FIELDS = editSample as FormField[]

/**
 * Edit viewer block — filled form fields beside the source document, linked by
 * their bbox. `EditViewer` owns the field panel (Original/Filled toggle, search,
 * filled/empty filters, page grouping); the document surface here is the
 * `PdfViewer`. Hover or select a field to highlight its region on the page and
 * scroll it into view; toggle Filled to stamp each value into its box.
 */
export function EditViewerBlock() {
  return (
    <div className="flex h-full min-h-[680px] flex-col bg-background">
      <EditViewer
        detectedFields={EDIT_FIELDS}
        hasFilled
        hasOriginal
        renderDocument={({ viewerRef, renderPageOverlay }) => (
          <PdfViewer
            ref={viewerRef}
            src={PDF_URL}
            bare
            downloadFileName="fidelity-bank-wire-authorization.pdf"
            className="h-full"
            renderPageOverlay={renderPageOverlay}
          />
        )}
      />
    </div>
  )
}
