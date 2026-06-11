"use client"

import type { ClassifyResult } from "@/components/viewers/lib/classify-types"
import { ClassifierViewer } from "@/components/viewers/classify/classifier-viewer"
import { PdfViewer } from "@/components/ui/pdf-viewer"

const PDF_URL = "/samples/loan-application.pdf"

// A classification result: one category over the whole document.
const CLASSIFY_RESULT: ClassifyResult = {
  category: "Loan Application",
  reasoning:
    "The document is a Uniform Residential Loan Application (Form 1003): it collects borrower, employment, and property details for a mortgage request, which matches the Loan Application category.",
}

/**
 * Classification viewer block — the file + legend system over a single category.
 * A classification reduces to one segment, shown as a swatch + label in the
 * legend header that `ClassifierViewer` renders below the `PdfViewer` toolbar.
 */
export function ClassificationViewerBlock() {
  return (
    <div className="flex h-full min-h-[680px] flex-col bg-background">
      <ClassifierViewer
        result={CLASSIFY_RESULT}
        renderDocument={(handlers) => (
          <PdfViewer
            src={PDF_URL}
            bare
            downloadFileName="loan-application.pdf"
            header={handlers.header}
            className="h-full"
          />
        )}
      />
    </div>
  )
}
