"use client";

import * as React from "react";

import { useKeyedMountEffect } from "@/hooks/use-keyed-mount-effect";
import { joinEffectKey } from "@/lib/effect-key";
import { cn } from "@/lib/utils";

import { type FileViewerControlsPlacement } from "./file-viewer-core";
import { FileErrorBoundary, ViewerFallback } from "./file-viewer-fallback";
import { useFileViewerRequiredResourceState } from "./file-viewer-resource-state";
import { FileViewerRoute } from "./file-viewer-route";
import { useOptionalViewerRootDiagnostics } from "./viewer-root";
import { useIsInsideViewerViewport } from "./viewer-surface";
import { warnViewerDevelopmentOnce } from "./viewer-diagnostics";

export type FileViewerDocumentProps = {
  className?: string;
  controls?: FileViewerControlsPlacement;
};

type FileViewerDocumentUnmountRecord = {
  layoutSignature: string;
  unmountedAt: number;
};

const recentFileViewerDocumentUnmounts = new Map<
  string,
  FileViewerDocumentUnmountRecord
>();

export function FileViewerDocument({
  className,
  controls = "toolbar",
}: FileViewerDocumentProps) {
  const isInsideViewport = useIsInsideViewerViewport();

  if (process.env.NODE_ENV !== "production" && !isInsideViewport) {
    throw new Error(
      "FileViewerDocument must be rendered inside FileViewerViewport.",
    );
  }

  return (
    <FileViewerDocumentContent
      className={cn("h-full", className)}
      controls={controls}
    />
  );
}

function FileViewerDocumentContent({
  className,
  controls,
}: Required<Pick<FileViewerDocumentProps, "controls">> &
  Pick<FileViewerDocumentProps, "className">) {
  const {
    descriptor,
    descriptorKey,
    descriptorSignal,
    fallbackFrameSize,
    fallbackSlideSize,
    isClient,
    isolateStyles,
    resource,
  } = useFileViewerRequiredResourceState();
  const rootDiagnostics = useOptionalViewerRootDiagnostics();
  const latestRootDiagnosticsRef = React.useRef(rootDiagnostics);
  latestRootDiagnosticsRef.current = rootDiagnostics;
  const documentInstanceKey = rootDiagnostics
    ? joinEffectKey([
        "file-viewer-document-instance",
        rootDiagnostics.rootId,
        descriptorKey,
      ])
    : null;

  useKeyedMountEffect(documentInstanceKey, () => {
    const diagnostics = latestRootDiagnosticsRef.current;
    if (!diagnostics) return;

    const recordKey = `${diagnostics.rootId}:${descriptorKey}`;
    const previousUnmount = recentFileViewerDocumentUnmounts.get(recordKey);
    recentFileViewerDocumentUnmounts.delete(recordKey);

    if (
      previousUnmount &&
      previousUnmount.layoutSignature !== diagnostics.layoutSignature &&
      Date.now() - previousUnmount.unmountedAt < 5000
    ) {
      warnViewerDevelopmentOnce({
        code: "file_viewer_document_layout_remount",
        message:
          "file viewer document remounted after a layout-only state change.",
        rootId: diagnostics.rootId,
        details: {
          currentLayoutSignature: diagnostics.layoutSignature,
          descriptorKey,
          previousLayoutSignature: previousUnmount.layoutSignature,
        },
      });
    }

    return () => {
      const latestDiagnostics = latestRootDiagnosticsRef.current;
      if (!latestDiagnostics) return;

      recentFileViewerDocumentUnmounts.set(
        `${latestDiagnostics.rootId}:${descriptorKey}`,
        {
          layoutSignature: latestDiagnostics.layoutSignature,
          unmountedAt: Date.now(),
        },
      );
    };
  });

  const fallback = (
    <ViewerFallback
      resource={resource}
      className={className}
      bare
      controls={controls === "local"}
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
      showDownload={controls === "local"}
    >
      <React.Suspense fallback={fallback}>
        <FileViewerRoute
          className={className}
          controls={controls}
          descriptor={descriptor}
          descriptorSignal={descriptorSignal}
          fallbackFrameSize={fallbackFrameSize}
          fallbackSlideSize={fallbackSlideSize}
          frame="none"
          isolateStyles={isolateStyles}
          resource={resource}
        />
      </React.Suspense>
    </FileErrorBoundary>
  );
}
