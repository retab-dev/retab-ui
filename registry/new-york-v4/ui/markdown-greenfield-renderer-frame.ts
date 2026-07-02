"use client";

import * as React from "react";

import { FILE_VIEWER_BEFORE_LAYOUT_MOTION_EVENT } from "./file-viewer-elements";
import {
  resolveFileViewerRendererLayoutInlineSize,
  type FileViewerDocumentAlign,
} from "./file-viewer-renderer-contract";
import {
  useOptionalFileViewerRendererEnvironment,
  useOptionalFileViewerRendererFrame,
} from "./file-viewer-renderer-frame";

export type MarkdownGreenfieldRendererFrame = {
  setDocumentSurfaceElement: React.RefCallback<HTMLDivElement>;
  transformOrigin: string;
  usesShellGeometry: boolean;
  viewportInlineSize: number;
};

export function useMarkdownGreenfieldRendererFrame({
  fallbackViewportInlineSize,
  onBeforeLayoutMotion,
}: {
  fallbackViewportInlineSize: number;
  onBeforeLayoutMotion: () => void;
}): MarkdownGreenfieldRendererFrame {
  const rendererEnvironment = useOptionalFileViewerRendererEnvironment();
  const rendererFrame = useOptionalFileViewerRendererFrame({
    fallbackInlineSize: fallbackViewportInlineSize,
  });
  const viewportInlineSize =
    resolveFileViewerRendererLayoutInlineSize({
      fallbackInlineSize: fallbackViewportInlineSize,
      rendererFrame,
    }) ?? fallbackViewportInlineSize;
  const surfaceRef = React.useRef<HTMLDivElement | null>(null);
  const handleBeforeLayoutMotion = React.useCallback(() => {
    onBeforeLayoutMotion();
  }, [onBeforeLayoutMotion]);
  const setDocumentSurfaceElement = React.useCallback(
    (element: HTMLDivElement | null) => {
      const previousElement = surfaceRef.current;
      if (previousElement === element) return;
      previousElement?.removeEventListener(
        FILE_VIEWER_BEFORE_LAYOUT_MOTION_EVENT,
        handleBeforeLayoutMotion,
      );
      surfaceRef.current = element;
      rendererEnvironment.setDocumentSurfaceElement(element);
      if (!element) return;
      element.addEventListener(
        FILE_VIEWER_BEFORE_LAYOUT_MOTION_EVENT,
        handleBeforeLayoutMotion,
      );
    },
    [
      handleBeforeLayoutMotion,
      rendererEnvironment.setDocumentSurfaceElement,
    ],
  );

  return React.useMemo(
    () => ({
      setDocumentSurfaceElement,
      transformOrigin: getMarkdownGreenfieldDocumentTransformOrigin(
        rendererFrame.align,
      ),
      usesShellGeometry: rendererEnvironment.usesShellGeometry,
      viewportInlineSize,
    }),
    [
      rendererEnvironment.usesShellGeometry,
      rendererFrame.align,
      setDocumentSurfaceElement,
      viewportInlineSize,
    ],
  );
}

function getMarkdownGreenfieldDocumentTransformOrigin(
  align: FileViewerDocumentAlign,
) {
  switch (align) {
    case "start":
      return "left top";
    case "end":
      return "right top";
    case "center":
      return "center top";
  }
}
