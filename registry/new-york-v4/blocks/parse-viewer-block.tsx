"use client";

import * as React from "react";

import { useKeyedMountEffect } from "@/hooks/use-keyed-mount-effect";
import {
  FileViewer,
  FileViewerBody,
  FileViewerSurface,
} from "@/components/ui/file-viewer";
import {
  PdfViewerPages,
  PdfViewerProvider,
  type PdfViewerHandle,
} from "@/components/ui/pdf-viewer";
import {
  ViewerBody,
  ViewerHeader,
  ViewerRoot,
  ViewerSidebar,
  ViewerSidebarTrigger,
  ViewerSurface,
} from "@/components/ui/viewer";
import type { ParseResponse } from "@/components/viewers/lib/parse-types";
import {
  ParseViewerHeader,
  ParseViewerMarkdown,
  ParseViewerProvider,
  useParseViewerDocument,
} from "@/components/viewers/parse/parse-viewer";
import parseSample from "@/components/viewers/sample-data/parse.json";

const PDF_URL = "/samples/bank-statement-x4uhhi7t.pdf";
const PDF_FILE_NAME = "bank-statement.pdf";

// A parse of the bank-statement sample: per-page, LLM-ready markdown with the
// transactions reconstructed as a table.
const PARSE_RESULT: ParseResponse = {
  output: parseSample.output as ParseResponse["output"],
  usage: parseSample.usage as ParseResponse["usage"],
};

/**
 * Parse viewer block — the source document beside its extracted markdown, kept
 * in sync by page. `ParseViewer` owns the markdown pane (Rendered/Text toggle,
 * page controls); the document surface here is FileViewer + PDF pages.
 */
export function ParseViewerBlock() {
  return (
    <div className="bg-background flex h-full min-h-[680px] flex-col">
      <ParseViewerProvider result={PARSE_RESULT}>
        <ViewerRoot defaultOpen className="bg-background h-full flex-1">
          <ParseViewerBlockHeader />
          <ViewerBody className="flex-col md:flex-row">
            <ViewerSurface className="relative">
              <ParseSourceDocument />
            </ViewerSurface>
            <ViewerSidebar
              aria-label="Parsed document content"
              side="right"
              width="420px"
              className="bg-background max-h-[42%] min-h-[240px] border-t md:max-h-none md:max-w-[50%] md:border-t-0 md:border-l"
            >
              <ParseViewerMarkdown />
            </ViewerSidebar>
          </ViewerBody>
        </ViewerRoot>
      </ParseViewerProvider>
    </div>
  );
}

function ParseViewerBlockHeader() {
  return (
    <ViewerHeader className="flex min-h-10 flex-wrap items-center gap-2 px-2 py-1 sm:flex-nowrap sm:py-0">
      <div className="flex h-8 min-w-0 items-center gap-2">
        <ViewerSidebarTrigger className="-ml-1" />
        <span className="text-foreground min-w-0 truncate text-sm font-medium">
          {PDF_FILE_NAME}
        </span>
        <span className="text-muted-foreground shrink-0 text-xs">pdf</span>
      </div>
      <ParseViewerHeader className="ml-0 min-w-0 border-b-0 bg-transparent sm:ml-auto" />
    </ViewerHeader>
  );
}

function ParseSourceDocument() {
  const document = useParseViewerDocument();
  const viewerRef = React.useRef<PdfViewerHandle | null>(null);
  const documentKey = useObjectDependencyKey(document);

  useKeyedMountEffect(documentKey, () => {
    document.setDocumentHandle({
      scrollToPage: (pageNumber, options) => {
        viewerRef.current?.scrollToPage(pageNumber, options);
      },
    });
    return () => document.setDocumentHandle(null);
  });

  return (
    <FileViewer
      source={{
        kind: "url",
        url: PDF_URL,
        fileName: PDF_FILE_NAME,
      }}
      className="h-full"
    >
      <PdfViewerProvider>
        <FileViewerBody>
          <FileViewerSurface>
            <PdfViewerPages
              ref={viewerRef}
              bare
              onVisiblePageChange={document.onCurrentPageChange}
              onScrollProgressChange={document.onScrollProgressChange}
              className="h-full"
            />
          </FileViewerSurface>
        </FileViewerBody>
      </PdfViewerProvider>
    </FileViewer>
  );
}

function useObjectDependencyKey(value: object): string {
  const keyRef = React.useRef(0);
  const valueRef = React.useRef<object | null>(null);

  if (valueRef.current !== value) {
    valueRef.current = value;
    keyRef.current += 1;
  }

  return `object:${keyRef.current}`;
}
