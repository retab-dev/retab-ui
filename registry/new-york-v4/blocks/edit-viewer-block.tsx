"use client"

import { EditViewer } from "@/components/viewers/edit/edit-viewer"
import type { FormField } from "@/components/viewers/lib/edit-types"
import editSample from "@/components/viewers/sample-data/edit.json"

const ORIGINAL_PDF_URL = "/samples/fidelity-edit/fidelity_original.pdf"

// A template-fill of the Fidelity "Bank Wire Authorization" form: 29 detected
// form fields across 3 pages, each with a normalized bbox and an inferred value.
const EDIT_FIELDS = editSample as FormField[]

/**
 * Edit viewer block — detected fields beside the source document, linked by
 * their bbox. `EditViewer` owns the mode switcher, overlay preview, search,
 * filters, and page grouping. Hover or select a field to highlight its region on
 * the page and scroll it into view.
 */
export function EditViewerBlock() {
  return (
    <div className="flex h-full min-h-[680px] flex-col bg-background">
      <EditViewer
        result={{ fields: EDIT_FIELDS }}
        sourceDocument={{
          src: ORIGINAL_PDF_URL,
          mimeType: "application/pdf",
          filename: "fidelity-bank-wire-authorization.pdf",
        }}
      />
    </div>
  )
}
