"use client";

import * as React from "react";

import { useMountEffect } from "@/hooks/use-mount-effect";
import type { BlobViewerSource, UrlViewerSource } from "@/lib/viewer-source";
import {
  FileViewerBody,
  FileViewerDocument,
  FileViewer,
  FileViewerProvider,
  FileViewerSurface,
  FileViewerViewport,
} from "@/components/ui/file-viewer";
import {
  PdfViewerPages,
  PdfViewerProvider,
  type PageOverlayProps,
  type PdfViewerHandle,
} from "@/components/ui/pdf-viewer";
import { useSegmentedDocumentViewport } from "@/components/ui/segmented-document-provider";

import {
  canPreviewEditViewerDocument,
  type EditViewerDocumentTarget,
} from "./edit-viewer-model";
import { EditViewerErrorState, NoDocumentState } from "./edit-viewer-states";
import type { EditViewerDocumentSource } from "./edit-viewer-types";

export function EditViewerDocumentPane({
  target,
  renderPageOverlay,
  viewerRef,
}: {
  target: EditViewerDocumentTarget;
  renderPageOverlay: (props: PageOverlayProps) => React.ReactNode;
  viewerRef: React.RefObject<PdfViewerHandle | null>;
}) {
  if (target.kind === "error") {
    return <EditViewerErrorState message={target.message} />;
  }

  if (target.kind === "filled") {
    return <FilledDocumentRenderer document={target.document} />;
  }

  if (target.kind === "source" || target.kind === "preview") {
    return (
      <SourceDocumentRenderer
        document={target.document}
        renderPageOverlay={renderPageOverlay}
        viewerRef={viewerRef}
        showPreview={target.showOverlay}
      />
    );
  }

  return <NoDocumentState message={target.message} />;
}

function SourceDocumentRenderer({
  document,
  renderPageOverlay,
  viewerRef,
  showPreview,
}: {
  document: EditViewerDocumentSource;
  renderPageOverlay: (props: PageOverlayProps) => React.ReactNode;
  viewerRef: React.RefObject<PdfViewerHandle | null>;
  showPreview: boolean;
}) {
  const { documentHandlers } = useSegmentedDocumentViewport();
  const documentHandlersRef = React.useRef(documentHandlers);
  const source = useDocumentViewerSource(document);
  documentHandlersRef.current = documentHandlers;
  const setPdfViewerHandle = React.useCallback(
    (handle: PdfViewerHandle | null) => {
      viewerRef.current = handle;
      documentHandlers.setDocumentHandle(handle);
    },
    [documentHandlers, viewerRef],
  );

  useMountEffect(() => () => {
    documentHandlersRef.current.setDocumentHandle(null);
  });

  if (!source) {
    return <NoDocumentState message="Document preview is unavailable." />;
  }

  if (canPreviewEditViewerDocument(document)) {
    return (
      <FileViewerProvider source={source}>
        <FileViewer>
          <PdfViewerProvider>
            <FileViewerBody>
              <FileViewerSurface>
                <FileViewerViewport>
                  <PdfViewerPages
                    ref={setPdfViewerHandle}
                    bare
                    className="h-full"
                    onScrollProgressChange={
                      documentHandlers.onScrollProgressChange
                    }
                    onVisiblePageChange={documentHandlers.onCurrentPageChange}
                    renderPageOverlay={
                      showPreview ? renderPageOverlay : undefined
                    }
                  />
                </FileViewerViewport>
              </FileViewerSurface>
            </FileViewerBody>
          </PdfViewerProvider>
        </FileViewer>
      </FileViewerProvider>
    );
  }

  if (showPreview) {
    return (
      <NoDocumentState message="Preview requires a PDF source document." />
    );
  }

  return <EditFileViewerDocument source={source} />;
}

function FilledDocumentRenderer({
  document,
}: {
  document: EditViewerDocumentSource;
}) {
  const source = useDocumentViewerSource(document);
  if (!source) {
    return <NoDocumentState message="Document preview is unavailable." />;
  }

  return <EditFileViewerDocument source={source} />;
}

function EditFileViewerDocument({
  source,
}: {
  source: UrlViewerSource | BlobViewerSource;
}) {
  return (
    <FileViewerProvider source={source}>
      <FileViewer>
        <FileViewerBody>
          <FileViewerSurface>
            <FileViewerViewport>
              <FileViewerDocument />
            </FileViewerViewport>
          </FileViewerSurface>
        </FileViewerBody>
      </FileViewer>
    </FileViewerProvider>
  );
}

function useDocumentViewerSource(
  document: EditViewerDocumentSource,
): UrlViewerSource | BlobViewerSource | null {
  return React.useMemo(() => {
    const fileName = document.filename ?? "document";
    if (document.src) {
      return {
        kind: "url",
        url: document.src,
        fileName,
        mimeType: document.mimeType,
      };
    }
    if (!document.buffer) return null;

    return {
      kind: "blob",
      blob: new Blob([document.buffer], { type: document.mimeType }),
      identityKey: editViewerBufferIdentityKey(document.buffer),
      fileName,
      mimeType: document.mimeType,
    };
  }, [document.buffer, document.filename, document.mimeType, document.src]);
}

const editViewerBufferKeys = new WeakMap<ArrayBuffer, string>();
let nextEditViewerBufferKey = 0;

function editViewerBufferIdentityKey(buffer: ArrayBuffer): string {
  let key = editViewerBufferKeys.get(buffer);
  if (!key) {
    nextEditViewerBufferKey += 1;
    key = `edit-viewer-buffer:${nextEditViewerBufferKey}`;
    editViewerBufferKeys.set(buffer, key);
  }
  return key;
}
