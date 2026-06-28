"use client";

import * as React from "react";
import type { JSONSchema7 } from "json-schema";
import { useForm } from "react-hook-form";

import { extractionSourcesToSourceMap } from "@/lib/document-source";
import {
  FileViewer,
  FileViewerBody,
  FileViewerHeader,
  FileViewerHeaderEnd,
  FileViewerHeaderStart,
  FileViewerIdentity,
  FileViewerInset,
  FileViewerProvider,
  FileViewerSidebar,
  FileViewerSidebarTrigger,
  FileViewerToolbar,
  FileViewerViewport,
  type ViewerSource,
  useFileViewerResource,
} from "@/components/ui/file-viewer";
import {
  ImageViewerFrames,
  ImageViewerProvider,
  type ImageViewerHandle,
} from "@/components/ui/image-viewer";
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
  useSegmentedImageSourceOverlay,
  useSegmentedImageViewerHandle,
  useSegmentedPdfSourceOverlay,
  useSegmentedPdfViewerHandle,
} from "@/components/ui/source-segmented-document-overlays";
import { JsonForm } from "@/components/json-form/json-form";
import sourcesSample from "@/components/viewers/sample-data/json-form-sources.json";

const PDF_URL = "/samples/jane-doe-bank-statement-5-pages.pdf";
const PDF_SOURCE = {
  kind: "url" as const,
  url: PDF_URL,
  fileName: "jane-doe-bank-statement-5-pages.pdf",
};
const JSON_FORM_SOURCES_DEFAULT_OPEN_PATHS = ["transactions"] as const;

// An extraction of the bank-statement sample shaped like the
// `GET /v1/extractions/{id}/sources` response: a JSON Schema, the extracted
// values, and a parallel `sources` tree (leaves `{ value, source }`).
const SAMPLE_SCHEMA = sourcesSample.schema as JSONSchema7;
const SAMPLE_EXTRACTION = sourcesSample.extraction as Record<string, unknown>;
const SAMPLE_SOURCES = sourcesSample.sources;

export type JsonFormSourcesBlockProps = {
  defaultOpenPaths?: readonly string[];
  documentKind?: "pdf" | "image";
  extraction?: Record<string, unknown>;
  fallbackFrameSize?: { width: number; height: number };
  schema?: JSONSchema7;
  source?: ViewerSource;
  sources?: unknown;
};

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
  documentKind = "pdf",
  extraction = SAMPLE_EXTRACTION,
  fallbackFrameSize,
  schema = SAMPLE_SCHEMA,
  source = PDF_SOURCE,
  sources = SAMPLE_SOURCES,
}: JsonFormSourcesBlockProps = {}) {
  const sourceMap = React.useMemo(() => {
    const allSources = extractionSourcesToSourceMap(sources);
    return filterSourceMapToRenderedPaths({
      extraction,
      schema,
      sourceMap: allSources,
    });
  }, [extraction, schema, sources]);
  const segmentedDocument = React.useMemo(() => {
    const evidence = sourceMapToEvidenceModel({
      sourceMap,
      values: extraction,
      schema,
    });

    return createSourcesSegmentedDocumentModel({
      labels: Object.fromEntries(
        evidence.evidenceItems.map((item) => [item.id, item.payload.label]),
      ),
      sourceMap,
    });
  }, [extraction, schema, sourceMap]);

  return (
    <SegmentedDocumentProvider model={segmentedDocument}>
      <JsonFormSourcesContent
        defaultOpenPaths={defaultOpenPaths}
        documentKind={documentKind}
        extraction={extraction}
        fallbackFrameSize={fallbackFrameSize}
        schema={schema}
        source={source}
      />
    </SegmentedDocumentProvider>
  );
}

function JsonFormSourcesContent({
  defaultOpenPaths,
  documentKind,
  extraction,
  fallbackFrameSize,
  schema,
  source,
}: {
  defaultOpenPaths?: readonly string[];
  documentKind: "pdf" | "image";
  extraction: Record<string, unknown>;
  fallbackFrameSize?: { width: number; height: number };
  schema: JSONSchema7;
  source: ViewerSource;
}) {
  const link = useSegmentedSourceFieldLink();
  const renderPageOverlay = useSegmentedPdfSourceOverlay(link);
  const renderFrameOverlay = useSegmentedImageSourceOverlay(link);
  const setPdfViewerHandle = useSegmentedPdfViewerHandle();
  const setImageViewerHandle = useSegmentedImageViewerHandle();
  const form = useForm<Record<string, unknown>>({ defaultValues: extraction });
  const { documentHandlers } = useSegmentedDocumentViewport();

  return (
    <FileViewerProvider source={source} defaultSidebarOpen>
      <FileViewer
        sidebarMode="inline"
        sidebarSide="right"
        className="bg-background h-full min-h-[680px]"
      >
        <FileViewerHeader>
          <FileViewerHeaderStart>
            <FileViewerSidebarTrigger className="-ml-1" />
            <FileViewerIdentity />
          </FileViewerHeaderStart>
          <FileViewerHeaderEnd>
            <FileViewerToolbar />
          </FileViewerHeaderEnd>
        </FileViewerHeader>
        <FileViewerBody>
          <FileViewerInset>
            <FileViewerViewport>
              {documentKind === "pdf" ? (
                <PdfViewerProvider>
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
                </PdfViewerProvider>
              ) : (
                <FileResourceImageViewer
                  ref={setImageViewerHandle}
                  bare
                  className="h-full"
                  controls={false}
                  fallbackFrameSize={fallbackFrameSize}
                  onScrollProgressChange={
                    documentHandlers.onScrollProgressChange
                  }
                  onVisibleFrameChange={documentHandlers.onCurrentPageChange}
                  renderFrameOverlay={renderFrameOverlay}
                />
              )}
            </FileViewerViewport>
          </FileViewerInset>
          <FileViewerSidebar
            aria-label="Source-linked fields"
            side="right"
            width="420px"
            className="bg-background flex flex-shrink-0 flex-col border-l"
          >
            <div className="flex h-10 flex-shrink-0 items-center gap-2 border-b px-4">
              <SourceIndicator
                path={link.activeSourcePath}
                className="min-h-0 flex-1 px-0 py-0"
              />
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
          </FileViewerSidebar>
        </FileViewerBody>
      </FileViewer>
    </FileViewerProvider>
  );
}

const FileResourceImageViewer = React.forwardRef<
  ImageViewerHandle,
  React.ComponentProps<typeof ImageViewerFrames>
>(function FileResourceImageViewer(props, ref) {
  const resource = useFileViewerResource();
  return (
    <ImageViewerProvider resource={resource}>
      <ImageViewerFrames {...props} ref={ref} />
    </ImageViewerProvider>
  );
});

function filterSourceMapToRenderedPaths({
  extraction,
  schema,
  sourceMap,
}: {
  extraction: Record<string, unknown>;
  schema: JSONSchema7;
  sourceMap: ReturnType<typeof extractionSourcesToSourceMap>;
}) {
  const renderedPaths = new Set(schemaLeafPaths(schema, extraction));
  return Object.fromEntries(
    Object.entries(sourceMap).filter(([path]) => renderedPaths.has(path)),
  );
}

function schemaLeafPaths(
  schema: JSONSchema7 | boolean | undefined,
  value: unknown,
  prefix = "",
): string[] {
  if (!schema || typeof schema === "boolean") return [];

  if (schema.type === "object" || schema.properties) {
    return Object.entries(schema.properties ?? {}).flatMap(
      ([propertyName, propertySchema]) =>
        schemaLeafPaths(
          propertySchema,
          isRecord(value) ? value[propertyName] : undefined,
          joinPath(prefix, propertyName),
        ),
    );
  }

  if (schema.type === "array" || schema.items) {
    if (!Array.isArray(value)) return [];
    const itemSchema = Array.isArray(schema.items)
      ? schema.items[0]
      : schema.items;
    return value.flatMap((item, index) =>
      schemaLeafPaths(itemSchema, item, joinPath(prefix, String(index))),
    );
  }

  return prefix ? [prefix] : [];
}

function joinPath(prefix: string, segment: string) {
  return prefix ? `${prefix}.${segment}` : segment;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
