"use client";

import * as React from "react";

import { FileErrorBoundary, ViewerFallback } from "./file-viewer-fallback";
import { useFileViewerContext } from "./file-viewer-internal";
import { FileViewerRoute } from "./file-viewer-route";

export type FileViewerDocumentProps = {
  className?: string;
};

type FileViewerDocumentContentProps = FileViewerDocumentProps & {
  bare?: boolean;
};

export function FileViewerDocument({ className }: FileViewerDocumentProps) {
  return <FileViewerDocumentContent bare className={className} />;
}

function FileViewerDocumentContent({
  bare = false,
  className,
}: FileViewerDocumentContentProps) {
  const {
    descriptor,
    descriptorKey,
    descriptorSignal,
    documentChrome,
    fallbackFrameSize,
    fallbackSlideSize,
    isClient,
    isolateStyles,
    resource,
  } = useFileViewerContext();
  const fallback = (
    <ViewerFallback
      resource={resource}
      className={className}
      bare={bare}
      controls={documentChrome === "standalone"}
      fallbackFrameSize={fallbackFrameSize}
      fallbackSlideSize={fallbackSlideSize}
    />
  );

  if (!isClient) return fallback;

  return (
    <FileErrorBoundary
      key={descriptorKey}
      descriptor={descriptor}
      resource={resource}
      className={className}
      resetKey={descriptorKey}
      showDownload={documentChrome === "standalone"}
    >
      <React.Suspense fallback={fallback}>
        <FileViewerRoute
          bare={bare}
          className={className}
          descriptor={descriptor}
          descriptorSignal={descriptorSignal}
          fallbackFrameSize={fallbackFrameSize}
          fallbackSlideSize={fallbackSlideSize}
          isolateStyles={isolateStyles}
          resource={resource}
          documentChrome={documentChrome}
        />
      </React.Suspense>
    </FileErrorBoundary>
  );
}
