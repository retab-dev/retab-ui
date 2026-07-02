"use client";

import * as React from "react";

import type { Source } from "@/lib/document-source";
import {
  sourceToDocxHighlight,
  useDocxSourceTarget,
} from "@/components/ui/docx-source";
import { DocxViewer, type DocxViewerHandle } from "@/components/ui/docx-viewer";
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
import docxSample from "@/components/viewers/sample-data/docx-sources.json";

const DOCX_URL = "/samples/quarterly-business-review.docx";
const DOCX_SOURCE = {
  kind: "url" as const,
  url: DOCX_URL,
  fileName: "quarterly-business-review.docx",
};

type DocxField = SourceField & { source: Source };

/** A short locator hint per anchor kind, matching the other source blocks. */
function hintFor(source: Source): string | undefined {
  const a = source.anchor;
  if (a.kind === "docx_text_span") return `¶ ${a.paragraph + 1}`;
  if (a.kind === "docx_table_cell")
    return `Table ${a.table + 1} · R${a.row + 1}C${a.column + 1}`;
  return undefined;
}

const FIELDS = (docxSample as DocxField[]).map((field) => ({
  ...field,
  hint: hintFor(field.source),
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
 * DOCX sources block — values extracted from a Word document, linked to where
 * they came from. Hovering a field highlights its text in the document and
 * scrolls to it. Segmented source interaction owns preview/selection while the
 * DOCX source adapter owns rendered-document target navigation.
 */
export function DocxSourcesBlock() {
  const viewerRef = React.useRef<DocxViewerHandle>(null);

  return (
    <SegmentedDocumentProvider model={SEGMENTED_DOCUMENT}>
      <DocxSourcesContent viewerRef={viewerRef} />
    </SegmentedDocumentProvider>
  );
}

function DocxSourcesContent({
  viewerRef,
}: {
  viewerRef: React.RefObject<DocxViewerHandle | null>;
}) {
  const target = useDocxSourceTarget(viewerRef);
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
  const highlight = sourceToDocxHighlight(activeSource);

  return (
    <FileViewerProvider source={DOCX_SOURCE} defaultSidebarOpen>
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
              <DocxViewer
                ref={viewerRef}
                source={DOCX_SOURCE}
                bare
                className="h-full"
                controls={false}
                highlight={highlight}
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
  fieldByKey: ReadonlyMap<string, DocxField>;
  link: ReturnType<typeof useSegmentedSourceFieldLink>;
  target: ReturnType<typeof useDocxSourceTarget>;
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
