"use client";

import * as React from "react";

import { useKeyedMountEffect } from "@/hooks/use-keyed-mount-effect";
import {
  FileViewer,
  FileViewerBody,
  FileViewerProvider,
  FileViewerSurface,
  FileViewerViewport,
} from "@/components/ui/file-viewer";
import {
  PdfViewerPages,
  PdfViewerProvider,
  type PdfViewerHandle,
} from "@/components/ui/pdf-viewer";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { ViewerBody, ViewerRoot, ViewerSurface } from "@/components/ui/viewer";
import type { ParseResponse } from "@/components/viewers/lib/parse-types";
import {
  ParseViewerHeader,
  ParseViewerMarkdown,
  ParseViewerProvider,
  useParseViewerDocument,
} from "@/components/viewers/parse/parse-viewer";
import parseSample from "@/components/viewers/sample-data/parse.json";

const PDF_URL = "/samples/bank-statement-x4uhhi7t.pdf";

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
        <ViewerRoot className="bg-background h-full flex-1">
          <ParseViewerHeader />
          <ViewerBody>
            <ResizablePanelGroup
              orientation="horizontal"
              className="min-h-0 flex-1"
            >
              <ResizablePanel defaultSize={52} minSize={28}>
                <ViewerSurface className="h-full">
                  <ParseSourceDocument />
                </ViewerSurface>
              </ResizablePanel>
              <ResizableHandle withHandle />
              <ResizablePanel defaultSize={48} minSize={28}>
                <ViewerSurface className="h-full">
                  <ParseViewerMarkdown />
                </ViewerSurface>
              </ResizablePanel>
            </ResizablePanelGroup>
          </ViewerBody>
        </ViewerRoot>
      </ParseViewerProvider>
    </div>
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
    <FileViewerProvider
      source={{
        kind: "url",
        url: PDF_URL,
        fileName: "bank-statement.pdf",
      }}
    >
      <FileViewer>
        <PdfViewerProvider>
          <FileViewerBody>
            <FileViewerSurface>
              <FileViewerViewport>
                <PdfViewerPages
                  ref={viewerRef}
                  bare
                  onVisiblePageChange={document.onCurrentPageChange}
                  onScrollProgressChange={document.onScrollProgressChange}
                  className="h-full"
                />
              </FileViewerViewport>
            </FileViewerSurface>
          </FileViewerBody>
        </PdfViewerProvider>
      </FileViewer>
    </FileViewerProvider>
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
