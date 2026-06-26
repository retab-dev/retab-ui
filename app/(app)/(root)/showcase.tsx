"use client";

import * as React from "react";
import dynamic from "next/dynamic";

import { cn } from "@/lib/utils";

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

const HOME_SHOWCASE_ITEMS = [
  {
    id: "sources-viewer",
    title: "Sources",
    description:
      "Field-to-source linking: hover a value to highlight where it came from in the document.",
  },
  {
    id: "file-thumbnail",
    title: "File Thumbnail",
    description:
      "Real first-page previews for PDFs, Office files, images, and text, rendered client-side.",
  },
  {
    id: "file-viewer",
    title: "File Viewer",
    description:
      "One viewer shell that switches between document, image, spreadsheet, text, code, and archive-backed formats.",
  },
  {
    id: "ocr",
    title: "OCR",
    description:
      "A scanned document beside detected text blocks, confidence, and source polygons.",
  },
  {
    id: "schema-builder",
    title: "Schema Builder",
    description:
      "Visual JSON Schema editing for shaping the structure your extractions follow.",
  },
  {
    id: "json-form",
    title: "JSON Form Field",
    description:
      "Schema-driven, virtualized form fields that stay responsive across thousands of fields.",
  },
  {
    id: "json-table",
    title: "JSON Table",
    description: "Renders JSON data inside virtualized, editable tables.",
  },
] as const;

type HomeShowcaseItemId = (typeof HOME_SHOWCASE_ITEMS)[number]["id"];

const DEFAULT_HOME_SHOWCASE_ITEM_ID: HomeShowcaseItemId = "sources-viewer";

const HOME_SHOWCASE_PANELS = {
  "sources-viewer": SourcesViewerShowcasePanel,
  "file-thumbnail": FileThumbnailShowcasePanel,
  "file-viewer": FileViewerShowcasePanel,
  ocr: OcrShowcasePanel,
  "schema-builder": SchemaBuilderShowcasePanel,
  "json-form": JsonFormShowcasePanel,
  "json-table": JsonTableShowcasePanel,
} satisfies Record<HomeShowcaseItemId, React.ComponentType>;

export function HomeShowcase() {
  const [activeItemId, setActiveItemId] = React.useState<HomeShowcaseItemId>(
    DEFAULT_HOME_SHOWCASE_ITEM_ID,
  );
  const activeItem =
    HOME_SHOWCASE_ITEMS.find((item) => item.id === activeItemId) ??
    HOME_SHOWCASE_ITEMS[0];
  const ActivePanel = HOME_SHOWCASE_PANELS[activeItem.id];
  const idPrefix = React.useId();

  return (
    <div className="container-wrapper flex-1 p-0">
      <div className="container overflow-hidden px-0 lg:max-w-none">
        <div className="theme-neutral bg-muted/30 3xl:[--gap:--spacing(8)] dark:bg-background relative flex w-full max-w-none flex-col gap-(--gap) overflow-hidden p-12 [--gap:--spacing(8)] min-[1900px]:p-12 min-[1900px]:[--gap:--spacing(10)]! lg:p-6 lg:[--gap:--spacing(6)]">
          <div className="relative z-10 mx-auto flex w-full max-w-7xl flex-col gap-6">
            <HomeShowcaseTabs
              activeItemId={activeItem.id}
              idPrefix={idPrefix}
              onActiveItemChange={setActiveItemId}
            />

            <section
              id={`${idPrefix}-${activeItem.id}-panel`}
              role="tabpanel"
              aria-labelledby={`${idPrefix}-${activeItem.id}-tab`}
              className="flex min-w-0 flex-col gap-3"
            >
              <div className="max-w-3xl space-y-1">
                <h3 className="text-foreground text-sm font-medium">
                  {activeItem.title}
                </h3>
                <p className="text-muted-foreground text-sm text-pretty">
                  {activeItem.description}
                </p>
              </div>
              <ActivePanel key={activeItem.id} />
            </section>
          </div>

          <div className="from-background via-muted/30 absolute inset-x-0 top-0 z-1 h-120 bg-linear-to-b to-transparent dark:hidden" />
          <div className="from-background via-muted/20 dark:via-background/80 pointer-events-none absolute inset-x-0 bottom-0 z-20 h-[80px] bg-linear-to-t to-transparent" />
        </div>
      </div>
    </div>
  );
}

function HomeShowcaseTabs({
  activeItemId,
  idPrefix,
  onActiveItemChange,
}: {
  activeItemId: HomeShowcaseItemId;
  idPrefix: string;
  onActiveItemChange: (itemId: HomeShowcaseItemId) => void;
}) {
  return (
    <div className="flex flex-wrap items-start gap-x-6 gap-y-3 pb-3">
      <nav
        aria-label="Homepage showcases"
        className="w-full max-w-none min-w-0 flex-1 justify-start"
      >
        <ul
          role="tablist"
          className="grid w-full list-none grid-cols-[repeat(auto-fit,minmax(9.5rem,1fr))] items-start gap-x-8 gap-y-2"
        >
          {HOME_SHOWCASE_ITEMS.map((item) => {
            const isActive = item.id === activeItemId;
            return (
              <li key={item.id}>
                <button
                  type="button"
                  id={`${idPrefix}-${item.id}-tab`}
                  role="tab"
                  aria-controls={`${idPrefix}-${item.id}-panel`}
                  aria-selected={isActive}
                  className={cn(
                    "block w-full rounded-none bg-transparent p-0 text-left text-base font-medium tracking-tight transition-colors",
                    "focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-0 focus-visible:outline-none",
                    isActive
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                  onClick={() => onActiveItemChange(item.id)}
                >
                  {item.title}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}

function SourcesViewerShowcasePanel() {
  return (
    <div className="h-[680px] overflow-hidden rounded-xl border shadow-sm [&_[data-file-viewer-slot=legend]]:hidden">
      <DynamicJsonFormSourcesBlock />
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

function ShowcasePreviewFallback() {
  return <div className="bg-muted/20 h-full min-h-[560px]" />;
}
