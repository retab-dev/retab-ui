"use client";

import * as React from "react";
import dynamic from "next/dynamic";

import type { ShowcaseItemId } from "@/lib/showcase-items";

export function ShowcasePreviewFallback() {
  return <div className="bg-muted/20 h-full min-h-[560px]" />;
}

const DynamicJsonFormSourcesBlock = dynamic(
  () =>
    import("@/registry/new-york-v4/blocks/json-form-sources-block").then(
      (module) => module.JsonFormSourcesBlock,
    ),
  { loading: ShowcasePreviewFallback, ssr: false },
);
const DynamicFileThumbnailFormatsGrid = dynamic(
  () =>
    import("@/components/file-thumbnail-formats-demo").then(
      (module) => module.FileThumbnailFormatsGrid,
    ),
  { loading: ShowcasePreviewFallback, ssr: false },
);
const DynamicFileViewerTelemetryWidget = dynamic(
  () =>
    import("@/components/file-viewer-telemetry-widget").then(
      (module) => module.FileViewerTelemetryWidget,
    ),
  { ssr: false },
);
const DynamicFileViewerShowcase = dynamic(
  () =>
    import("@/components/file-viewer-demo").then(
      (module) => module.FileViewerShowcase,
    ),
  { loading: ShowcasePreviewFallback, ssr: false },
);
const DynamicOcrBlock = dynamic(
  () =>
    import("@/registry/new-york-v4/blocks/ocr-block").then(
      (module) => module.OcrBlock,
    ),
  { loading: ShowcasePreviewFallback, ssr: false },
);
const DynamicRetabSchemaBuilderDemo = dynamic(
  () =>
    import("@/components/retab-schema-builder-demo").then(
      (module) => module.RetabSchemaBuilderDemo,
    ),
  { loading: ShowcasePreviewFallback, ssr: false },
);
const DynamicJsonFormDemo = dynamic(
  () =>
    import("@/components/json-form-demo").then((module) => module.JsonFormDemo),
  { loading: ShowcasePreviewFallback, ssr: false },
);
const DynamicJsonTableDemo = dynamic(
  () =>
    import("@/components/json-table/json-table-demo").then(
      (module) => module.JsonTableDemo,
    ),
  { loading: ShowcasePreviewFallback, ssr: false },
);

function SourcesViewerShowcasePanel() {
  return (
    <div className="relative h-[680px] overflow-hidden rounded-xl border shadow-sm [&_[data-slot=file-viewer-legend]]:hidden">
      <DynamicJsonFormSourcesBlock />
      <DynamicFileViewerTelemetryWidget />
    </div>
  );
}

function FileThumbnailShowcasePanel() {
  return (
    <div className="overflow-hidden rounded-xl border shadow-sm">
      <DynamicFileThumbnailFormatsGrid />
    </div>
  );
}

function FileViewerShowcasePanel() {
  return <DynamicFileViewerShowcase showTitle={false} />;
}

function OcrShowcasePanel() {
  return (
    <div className="bg-background h-[680px] overflow-hidden rounded-xl border shadow-sm">
      <DynamicOcrBlock />
    </div>
  );
}

function SchemaBuilderShowcasePanel() {
  return (
    <div className="bg-card max-h-[640px] overflow-auto rounded-xl border p-4 shadow-sm">
      <DynamicRetabSchemaBuilderDemo showJsonTab={false} />
    </div>
  );
}

function JsonFormShowcasePanel() {
  return <DynamicJsonFormDemo showJsonTab={false} />;
}

function JsonTableShowcasePanel() {
  return <DynamicJsonTableDemo />;
}

export const SHOWCASE_PANELS = {
  "sources-viewer": SourcesViewerShowcasePanel,
  "file-thumbnail": FileThumbnailShowcasePanel,
  "file-viewer": FileViewerShowcasePanel,
  ocr: OcrShowcasePanel,
  "schema-builder": SchemaBuilderShowcasePanel,
  "json-form": JsonFormShowcasePanel,
  "json-table": JsonTableShowcasePanel,
} satisfies Record<ShowcaseItemId, React.ComponentType>;
