"use client";

import type { CSSProperties } from "react";

import { cn } from "@/lib/utils";
import {
  FileViewer,
  FileViewerBody,
  FileViewerHeader,
  FileViewerHeaderEnd,
  FileViewerHeaderStart,
  FileViewerIdentity,
  FileViewerProvider,
  FileViewerInset,
  FileViewerToolbar,
  FileViewerViewport,
} from "@/components/ui/file-viewer";
import { PdfViewerPages, PdfViewerProvider } from "@/components/ui/pdf-viewer";
import {
  ClassifierViewer,
  ClassifierViewerLegend,
} from "@/components/viewers/classify/classifier-viewer";

const LOAN_APPLICATION_SOURCE = {
  kind: "url" as const,
  url: "/samples/loan-application.pdf",
  fileName: "loan-application.pdf",
};

export function ClassificationViewerExample({
  className,
  style,
}: {
  className?: string;
  style?: CSSProperties;
} = {}) {
  return (
    <div
      className={cn(
        "not-prose flex min-h-0 flex-col overflow-hidden",
        className,
      )}
      style={{ height: 520, ...style }}
    >
      <ClassifierViewer
        result={{
          category: "Loan Application",
          candidates: [
            {
              category: "Loan Application",
              description: "Uniform Residential Loan Application Form 1003.",
            },
            {
              category: "Tax Form",
              description: "Structured form, but no IRS tax identifiers.",
            },
            {
              category: "Bank Statement",
              description: "Financial fields are present, but no transactions.",
            },
          ],
          reasoning:
            "The document is a Uniform Residential Loan Application (Form 1003): it collects borrower, employment, and property details for a mortgage request, which matches the Loan Application category.",
        }}
        document={<ClassificationPdfDocument />}
      />
    </div>
  );
}

function ClassificationPdfDocument() {
  return (
    <FileViewerProvider source={LOAN_APPLICATION_SOURCE}>
      <FileViewer className="h-full rounded-none border-0 bg-transparent">
        <PdfViewerProvider>
          <FileViewerHeader>
            <FileViewerHeaderStart>
              <FileViewerIdentity />
            </FileViewerHeaderStart>
            <FileViewerHeaderEnd>
              <FileViewerToolbar />
            </FileViewerHeaderEnd>
          </FileViewerHeader>
          <ClassifierViewerLegend />
          <FileViewerBody>
            <FileViewerInset>
              <FileViewerViewport>
                <PdfViewerPages bare className="h-full" />
              </FileViewerViewport>
            </FileViewerInset>
          </FileViewerBody>
        </PdfViewerProvider>
      </FileViewer>
    </FileViewerProvider>
  );
}
