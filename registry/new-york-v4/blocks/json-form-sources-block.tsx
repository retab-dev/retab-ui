"use client";

import type { JSONSchema7 } from "json-schema";
import { useForm } from "react-hook-form";

import { extractionSourcesToSourceMap } from "@/lib/document-source";
import {
  FileViewer,
  FileViewerBody,
  FileViewerControls,
  FileViewerHeader,
  FileViewerMeta,
  FileViewerSurface,
  FileViewerTitle,
} from "@/components/ui/file-viewer";
import { PdfViewerPages, PdfViewerProvider } from "@/components/ui/pdf-viewer";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  SegmentedDocumentProvider,
  useSegmentedDocumentViewport,
} from "@/components/ui/segmented-document-provider";
import { sourceMapToEvidenceModel } from "@/components/ui/source-evidence";
import { useSegmentedSourceFieldLink } from "@/components/ui/source-field-link";
import { SourceIndicator } from "@/components/ui/source-indicator";
import { createSourcesSegmentedDocumentModel } from "@/components/ui/source-segmented-document-model";
import {
  useSegmentedPdfSourceOverlay,
  useSegmentedPdfViewerHandle,
} from "@/components/ui/source-segmented-document-overlays";
import {
  ViewerBody,
  ViewerRoot,
  ViewerSidebar,
  ViewerSurface,
} from "@/components/ui/viewer";
import { JsonForm } from "@/components/json-form/json-form";
import sourcesSample from "@/components/viewers/sample-data/json-form-sources.json";

const PDF_URL = "/samples/jane-doe-bank-statement-5-pages.pdf";
const JSON_FORM_SOURCES_DEFAULT_OPEN_PATHS = ["transactions"] as const;

// An extraction of the bank-statement sample shaped like the
// `GET /v1/extractions/{id}/sources` response: a JSON Schema, the extracted
// values, and a parallel `sources` tree (leaves `{ value, source }`).
const schema = sourcesSample.schema as JSONSchema7;
const extraction = sourcesSample.extraction as Record<string, unknown>;
const SOURCES = extractionSourcesToSourceMap(sourcesSample.sources);
const EVIDENCE = sourceMapToEvidenceModel({
  sourceMap: SOURCES,
  values: extraction,
  schema,
});
const SEGMENTED_DOCUMENT = createSourcesSegmentedDocumentModel({
  labels: Object.fromEntries(
    EVIDENCE.evidenceItems.map((item) => [item.id, item.payload.label]),
  ),
  sourceMap: SOURCES,
});

/**
 * JSON Form ⨯ PDF sources block — extraction rendered as a form beside the source
 * document, linked by their sources. Hovering a form field highlights where its
 * value came from in the PDF and scrolls to it.
 *
 * This is the abstraction working across components that don't know about each
 * other: `json-form` receives a source link and every field reports its
 * path on hover; the PDF adapter is the target. No bespoke wiring between form
 * and viewer.
 */
export function JsonFormSourcesBlock({
  defaultOpenPaths = JSON_FORM_SOURCES_DEFAULT_OPEN_PATHS,
}: {
  defaultOpenPaths?: readonly string[];
} = {}) {
  return (
    <SegmentedDocumentProvider model={SEGMENTED_DOCUMENT}>
      <JsonFormSourcesContent defaultOpenPaths={defaultOpenPaths} />
    </SegmentedDocumentProvider>
  );
}

function JsonFormSourcesContent({
  defaultOpenPaths,
}: {
  defaultOpenPaths?: readonly string[];
}) {
  const link = useSegmentedSourceFieldLink();
  const { documentHandlers } = useSegmentedDocumentViewport();
  const renderPageOverlay = useSegmentedPdfSourceOverlay(link);
  const setPdfViewerHandle = useSegmentedPdfViewerHandle();
  const form = useForm<Record<string, unknown>>({ defaultValues: extraction });

  return (
    <ViewerRoot className="bg-background h-full min-h-[680px]">
      <ViewerBody>
        <ViewerSurface className="relative">
          <FileViewer
            source={{
              kind: "url",
              url: PDF_URL,
              fileName: "jane-doe-bank-statement-5-pages.pdf",
            }}
            className="h-full"
          >
            <FileViewerHeader>
              <FileViewerTitle />
              <FileViewerMeta />
              <FileViewerControls />
            </FileViewerHeader>
            <PdfViewerProvider>
              <FileViewerBody>
                <FileViewerSurface>
                  <PdfViewerPages
                    ref={setPdfViewerHandle}
                    bare
                    className="h-full"
                    onScrollProgressChange={
                      documentHandlers.onScrollProgressChange
                    }
                    onVisiblePageChange={documentHandlers.onCurrentPageChange}
                    renderPageOverlay={renderPageOverlay}
                  />
                </FileViewerSurface>
              </FileViewerBody>
            </PdfViewerProvider>
          </FileViewer>
          <SourceIndicator
            path={link.activeSourcePath}
            found={!!link.activeAnchor}
            className="top-12"
          />
        </ViewerSurface>
        <ViewerSidebar
          aria-label="Extracted data sources"
          side="right"
          collapsible="none"
          width="420px"
          className="border-l"
        >
          <div className="flex h-10 flex-shrink-0 items-center gap-2 border-b px-4">
            <h2 className="text-sm font-medium">Extracted data</h2>
            <span className="text-muted-foreground ml-auto text-xs">
              Hover a field to see its source
            </span>
          </div>
          <ScrollArea className="min-h-0 flex-1">
            <div className="p-4">
              <JsonForm
                form={form}
                schema={schema}
                sourceLink={link}
                defaultOpenPaths={defaultOpenPaths}
              />
            </div>
          </ScrollArea>
        </ViewerSidebar>
      </ViewerBody>
    </ViewerRoot>
  );
}
