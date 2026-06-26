"use client";

import * as React from "react";

import type { Source } from "@/lib/document-source";
import {
  FileViewer,
  FileViewerBody,
  FileViewerHeader,
  FileViewerHeaderEnd,
  FileViewerHeaderStart,
  FileViewerIdentity,
  FileViewerProvider,
  FileViewerSidebar,
  FileViewerSidebarContent,
  FileViewerSurface,
  FileViewerToolbar,
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
  sourceToTextHighlight,
  useTextSourceTarget,
} from "@/components/ui/text-source";
import { TextViewer, type TextViewerHandle } from "@/components/ui/text-viewer";
import textSample from "@/components/viewers/sample-data/text-sources.json";

const TEXT_URL = "/samples/extraction-run.log";
const TEXT_SOURCE = {
  kind: "url" as const,
  url: TEXT_URL,
  fileName: "extraction-run.log",
};

type TextField = SourceField & { source: Source };

const FIELDS = (textSample as TextField[]).map((field) => ({
  ...field,
  hint:
    field.source.anchor.kind === "text_span"
      ? `Line ${field.source.anchor.line_start}`
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
 * Text sources block — values extracted from a log file, linked to the lines
 * they came from. Hovering a field highlights its line range and scrolls to it.
 * Segmented source interaction owns field preview/selection while the text
 * source adapter owns line-range scrolling and highlighting.
 */
export function TextSourcesBlock() {
  const viewerRef = React.useRef<TextViewerHandle>(null);

  return (
    <SegmentedDocumentProvider model={SEGMENTED_DOCUMENT}>
      <TextSourcesContent viewerRef={viewerRef} />
    </SegmentedDocumentProvider>
  );
}

function TextSourcesContent({
  viewerRef,
}: {
  viewerRef: React.RefObject<TextViewerHandle | null>;
}) {
  const target = useTextSourceTarget(viewerRef);
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
  const highlight = sourceToTextHighlight(activeSource);

  return (
    <FileViewerProvider source={TEXT_SOURCE} defaultSidebarOpen>
      <FileViewer
        className="bg-background h-full min-h-[680px]"
        sidebarSide="right"
      >
        <FileViewerHeader>
          <FileViewerHeaderStart>
            <FileViewerIdentity />
          </FileViewerHeaderStart>
          <FileViewerHeaderEnd>
            <FileViewerToolbar />
          </FileViewerHeaderEnd>
        </FileViewerHeader>
        <FileViewerBody>
          <FileViewerSurface>
            <FileViewerViewport>
              <TextViewer
                ref={viewerRef}
                source={TEXT_SOURCE}
                bare
                className="h-full"
                controls={false}
                highlight={highlight}
                mode="text"
              />
            </FileViewerViewport>
          </FileViewerSurface>
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
        </FileViewerBody>
      </FileViewer>
    </FileViewerProvider>
  );
}

function useTargetedSourceFieldLink({
  fieldByKey,
  link,
  target,
}: {
  fieldByKey: ReadonlyMap<string, TextField>;
  link: ReturnType<typeof useSegmentedSourceFieldLink>;
  target: ReturnType<typeof useTextSourceTarget>;
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
