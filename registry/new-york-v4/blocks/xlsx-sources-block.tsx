"use client";

import * as React from "react";

import type { Source } from "@/lib/document-source";
import {
  FileViewer,
  FileViewerContent,
  FileViewerHeader,
  FileViewerTitle,
  FileViewerProvider,
  FileViewerSidebar,
  FileViewerSidebarContent,
  FileViewerInset,
  FileViewerControls,
  FileViewerViewport,
} from "@/components/ui/file-viewer";
import { SegmentedDocumentProvider } from "@/components/ui/segmented-document-provider";
import { useSegmentedSourceFieldLink } from "@/components/ui/source-field-link";
import {
  SourceFieldList,
  type SourceField,
} from "@/components/ui/source-field-list";
import { createSourcesSegmentedDocumentModel } from "@/components/ui/source-segmented-document-model";
import {
  sourceToXlsxCell,
  useXlsxSourceTarget,
} from "@/components/ui/xlsx-source";
import { XlsxViewer, type XlsxViewerHandle } from "@/components/ui/xlsx-viewer";
import xlsxSample from "@/components/viewers/sample-data/xlsx-sources.json";

const XLSX_URL = "/samples/nvidia-financials-fy2024.xlsx";
const XLSX_SOURCE = {
  kind: "url" as const,
  url: XLSX_URL,
  fileName: "nvidia-financials-fy2024.xlsx",
};

type XlsxField = SourceField & { source: Source };

const FIELDS = (xlsxSample as XlsxField[]).map((field) => ({
  ...field,
  hint:
    field.source.anchor.kind === "spreadsheet_cell"
      ? `${field.source.anchor.sheet_name ?? `Sheet ${field.source.anchor.sheet_index + 1}`} · ${field.source.anchor.coordinate ?? ""}`
      : undefined,
}));
const FIELD_BY_KEY = new Map(FIELDS.map((field) => [field.key, field]));
const SEGMENTED_DOCUMENT = createSourcesSegmentedDocumentModel(
  FIELDS.map((field) => ({
    id: field.key,
    label: field.label,
    source: field.source,
  })),
);

/**
 * Excel sources block — extracted values linked to the spreadsheet cells they
 * came from, across sheets. Hovering a field switches to its sheet, highlights
 * the cell, and scrolls to it. Segmented source interaction owns
 * preview/selection while the XLSX source adapter owns sheet-aware navigation.
 */
export function XlsxSourcesBlock() {
  const viewerRef = React.useRef<XlsxViewerHandle>(null);

  return (
    <SegmentedDocumentProvider model={SEGMENTED_DOCUMENT}>
      <XlsxSourcesContent viewerRef={viewerRef} />
    </SegmentedDocumentProvider>
  );
}

function XlsxSourcesContent({
  viewerRef,
}: {
  viewerRef: React.RefObject<XlsxViewerHandle | null>;
}) {
  const target = useXlsxSourceTarget(viewerRef);
  const segmentedLink = useSegmentedSourceFieldLink({
    initialSourcePath: FIELDS[0]?.key,
  });
  const link = useTargetedSourceFieldLink({
    fieldByKey: FIELD_BY_KEY,
    link: segmentedLink,
    target,
  });
  const activeSource = link.activeSourcePath
    ? FIELD_BY_KEY.get(link.activeSourcePath)?.source
    : undefined;
  const activeCell = sourceToXlsxCell(activeSource);

  return (
    <FileViewerProvider source={XLSX_SOURCE} defaultSidebarOpen>
      <FileViewer
        className="bg-background h-full min-h-[680px]"
       
      >
        <FileViewerHeader>
            <FileViewerTitle />
            <FileViewerControls />
        </FileViewerHeader>
        <FileViewerContent>
          <FileViewerInset>
            <FileViewerViewport>
              <XlsxViewer
                ref={viewerRef}
                source={XLSX_SOURCE}
                bare
                className="h-full"
                controls={false}
                activeCell={activeCell}
              />
            </FileViewerViewport>
          </FileViewerInset>
          <FileViewerSidebar
            aria-label="Source fields"
            side="right"
            collapsible="none"
            width="360px"
            className="border-l"
          >
            <FileViewerSidebarContent>
              <SourceFieldList fields={FIELDS} link={link} />
            </FileViewerSidebarContent>
          </FileViewerSidebar>
        </FileViewerContent>
      </FileViewer>
    </FileViewerProvider>
  );
}

function useTargetedSourceFieldLink({
  fieldByKey,
  link,
  target,
}: {
  fieldByKey: ReadonlyMap<string, XlsxField>;
  link: ReturnType<typeof useSegmentedSourceFieldLink>;
  target: ReturnType<typeof useXlsxSourceTarget>;
}) {
  const scrollToField = React.useCallback(
    (path: string, behavior: ScrollBehavior) => {
      const source = fieldByKey.get(path)?.source;
      if (source) target.scrollTo?.(source, { behavior });
    },
    [fieldByKey, target],
  );
  const onSourceHover = React.useCallback(
    (path: string | null) => {
      link.onSourceHover(path);
      if (path) scrollToField(path, "auto");
    },
    [link, scrollToField],
  );
  const selectSourcePath = React.useCallback(
    (path: string) => {
      link.selectSourcePath?.(path);
      scrollToField(path, "smooth");
    },
    [link, scrollToField],
  );

  return React.useMemo(
    () => ({
      ...link,
      onSourceHover,
      selectSourcePath,
    }),
    [link, onSourceHover, selectSourcePath],
  );
}
