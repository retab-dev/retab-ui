"use client";

import * as React from "react";

import { useKeyedMountEffect } from "@/hooks/use-keyed-mount-effect";
import { joinEffectKey } from "@/lib/effect-key";
import { type ViewerResource } from "@/lib/viewer-resource";
import {
  fileViewerDiagnostic,
  summarizeViewerDescriptor,
  summarizeViewerSource,
} from "@/lib/pdf-viewer-diagnostics";

import {
  isProseTextDescriptor,
  type FileCategory,
  type FileViewerControlsPlacement,
  type FileDescriptor,
  type FileViewerFallbackSize,
} from "./file-viewer-core";
import { CsvFileContent } from "./file-viewer-csv-viewer";
import { UnsupportedCard } from "./file-viewer-fallback";
import { HtmlFileContent } from "./file-viewer-html-viewer";
import {
  getFileViewerPrewarmTarget,
  scheduleFileViewerRendererPrewarm,
} from "./file-viewer-prewarm";

const PdfResourceContent = React.lazy(() =>
  import("@/components/ui/pdf-viewer").then((m) => ({
    default: m.PdfResourceContent,
  })),
);
const DocxResourceContent = React.lazy(() =>
  import("@/components/ui/docx-viewer").then((m) => ({
    default: m.DocxResourceContent,
  })),
);
const ImageResourceContent = React.lazy(() =>
  import("@/components/ui/image-viewer").then((m) => ({
    default: m.ImageResourceContent,
  })),
);
const PptxResourceContent = React.lazy(() =>
  import("@/components/ui/pptx-viewer").then((m) => ({
    default: m.PptxResourceContent,
  })),
);
const XlsxResourceContent = React.lazy(() =>
  import("@/components/ui/xlsx-viewer").then((m) => ({
    default: m.XlsxResourceContent,
  })),
);
const ProseTextViewer = React.lazy(() =>
  import("@/components/ui/text-viewer-chenglou").then((m) => ({
    default: m.ChenglouTextViewer,
  })),
);
const MarkdownViewer = React.lazy(() =>
  import("@/components/ui/markdown-viewer").then((m) => ({
    default: m.MarkdownViewer,
  })),
);
const CodeTextViewer = React.lazy(() =>
  import("@/components/ui/code-viewer").then((m) => ({
    default: m.CodeViewer,
  })),
);

export type FileViewerRouteProps = {
  className?: string;
  controls: FileViewerControlsPlacement;
  descriptor: FileDescriptor;
  descriptorSignal: AbortSignal;
  fallbackFrameSize?: FileViewerFallbackSize;
  fallbackSlideSize?: FileViewerFallbackSize;
  frame?: "contained" | "none";
  isolateStyles: boolean;
  resource: ViewerResource;
};

type RenderContext = {
  descriptor: FileDescriptor;
  resource: ViewerResource;
  className?: string;
  bare: boolean;
  controls: boolean;
  fallbackFrameSize?: FileViewerFallbackSize;
  fallbackSlideSize?: FileViewerFallbackSize;
  isolateStyles: boolean;
  descriptorSignal: AbortSignal;
};

// Categories a text-kind source (raw text, no blob/url backing) can render.
const TEXT_SOURCE_CATEGORIES = new Set<FileCategory>([
  "csv",
  "markdown",
  "html",
  "text",
]);

const RENDERERS: Partial<
  Record<FileCategory, (ctx: RenderContext) => React.ReactNode>
> = {
  pdf: ({ resource, className, bare, controls }) => (
    <PdfResourceContent
      resource={resource}
      className={className}
      bare={bare}
      controls={controls}
      download
    />
  ),
  docx: ({ resource, className, bare, controls }) => (
    <DocxResourceContent
      resource={resource}
      className={className}
      bare={bare}
      controls={controls}
      download
    />
  ),
  image: ({ resource, className, bare, controls, fallbackFrameSize }) => (
    <ImageResourceContent
      resource={resource}
      className={className}
      bare={bare}
      controls={controls}
      download
      fallbackFrameSize={fallbackFrameSize}
    />
  ),
  pptx: ({ resource, className, bare, controls, fallbackSlideSize }) => (
    <PptxResourceContent
      resource={resource}
      className={className}
      bare={bare}
      controls={controls}
      download
      fallbackSlideSize={fallbackSlideSize}
    />
  ),
  xlsx: ({ resource, className, bare, controls, isolateStyles }) => (
    <XlsxResourceContent
      resource={resource}
      className={className}
      bare={bare}
      controls={controls}
      download
      isolateStyles={isolateStyles}
    />
  ),
  csv: ({ resource, className, bare, controls, isolateStyles }) => (
    <CsvFileContent
      resource={resource}
      className={className}
      bare={bare}
      controls={controls}
      isolateStyles={isolateStyles}
    />
  ),
  html: ({ resource, className, bare, controls, descriptorSignal }) => (
    <HtmlFileContent
      resource={resource}
      className={className}
      bare={bare}
      controls={controls}
      descriptorSignal={descriptorSignal}
    />
  ),
  markdown: ({ resource, className, bare, controls }) => (
    <MarkdownViewer
      source={resource.descriptor.source}
      className={className}
      controls={controls}
      download
      bare={bare}
      urlFragmentNavigation={false}
    />
  ),
  text: renderTextViewer,
};

export function FileViewerRoute({
  descriptor,
  className,
  controls,
  frame = "contained",
  isolateStyles,
  descriptorSignal,
  fallbackFrameSize,
  fallbackSlideSize,
  resource,
}: FileViewerRouteProps) {
  const { category } = descriptor;
  const bare = frame === "none";
  const localControls = controls === "local";
  const isTextSource = descriptor.source.kind === "text";

  const renderer = RENDERERS[category];
  const textSourceAllowed =
    !isTextSource || TEXT_SOURCE_CATEGORIES.has(category);
  const isRouteRenderable = Boolean(renderer) && textSourceAllowed;
  const prewarmTarget = getFileViewerPrewarmTarget({
    descriptor,
    isRouteRenderable,
  });
  useKeyedMountEffect(
    prewarmTarget
      ? joinEffectKey(["file-viewer-renderer-prewarm", prewarmTarget])
      : null,
    () => {
      if (!prewarmTarget) return;
      return scheduleFileViewerRendererPrewarm(prewarmTarget);
    },
  );

  const routeDetails = {
    bare,
    category,
    controls,
    hasRenderer: Boolean(renderer),
    isTextSource,
    isolateStyles,
    source: summarizeViewerSource(descriptor.source),
    descriptor: summarizeViewerDescriptor(descriptor),
  };
  if (renderer && textSourceAllowed) {
    fileViewerDiagnostic("debug", "file_viewer_route_renderer_selected", {
      ...routeDetails,
      textSourceAllowed,
    });
    return renderer({
      descriptor,
      resource,
      className,
      bare,
      controls: localControls,
      fallbackFrameSize,
      fallbackSlideSize,
      isolateStyles,
      descriptorSignal,
    });
  }

  fileViewerDiagnostic("warn", "file_viewer_route_unsupported", {
    ...routeDetails,
    textSourceAllowed,
  });
  return (
    <UnsupportedCard
      resource={resource}
      className={className}
      bare={bare}
      showDownload={localControls}
    />
  );
}

function renderTextViewer({
  descriptor,
  resource,
  className,
  bare,
  controls,
}: RenderContext): React.ReactNode {
  const source = resource.descriptor.source;
  if (isProseTextDescriptor(descriptor)) {
    return (
      <ProseTextViewer
        source={source}
        className={className}
        controls={controls}
        download
        bare={bare}
        mode="text"
      />
    );
  }
  return (
    <CodeTextViewer
      source={source}
      className={className}
      controls={controls}
      download
      bare={bare}
    />
  );
}
