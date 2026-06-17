"use client"

import { PdfViewer } from "@/components/ui/pdf-viewer"
import { ClassifierViewer } from "@/components/viewers/classify/classifier-viewer"

export function ClassificationViewerExample() {
  return (
    <div
      className="not-prose flex min-h-0 flex-col overflow-hidden"
      style={{ height: 520 }}
    >
      <ClassifierViewer
        result={{
          category: "Loan Application",
          reasoning:
            "The document is a Uniform Residential Loan Application (Form 1003): it collects borrower, employment, and property details for a mortgage request, which matches the Loan Application category.",
        }}
        document={
          <PdfViewer
            source={{
              kind: "url",
              url: "/samples/loan-application.pdf",
              fileName: "loan-application.pdf",
            }}
            bare
            className="h-full"
          />
        }
      />
    </div>
  )
}
