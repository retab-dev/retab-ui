"use client";

import * as React from "react";

import { type SegmentInteraction } from "@/lib/segment-interaction";
import { segmentsPageCount, toSegments, type Segment } from "@/lib/segments";
import {
  FileViewer,
  FileViewerBody,
  FileViewerProvider,
  FileViewerSurface,
  FileViewerViewport,
} from "@/components/ui/file-viewer";
import { PageRibbon } from "@/components/ui/page-ribbon";
import { PdfViewerPages, PdfViewerProvider } from "@/components/ui/pdf-viewer";
import {
  SegmentLegend,
  type SegmentLegendOrientation,
  type SegmentLegendSide,
  type SegmentLegendVariant,
} from "@/components/ui/segment-legend";
import { useSegmentInteraction } from "@/components/ui/use-segment-interaction";
import {
  ViewerBody,
  ViewerRoot,
  ViewerSidebar,
  ViewerSurface,
} from "@/components/ui/viewer";

const PDF_URL = "/samples/an-image-is-worth-16x16-words.pdf";

// The same split result the standalone Split Viewer block uses, over the ViT paper.
const SPLIT_OUTPUT = [
  { name: "Title, Abstract & Introduction", pages: [1] },
  { name: "Related Work", pages: [2] },
  { name: "Method", pages: [3] },
  { name: "Experiments", pages: [4, 5, 6, 7, 8] },
  { name: "Conclusion & References", pages: [9, 10, 11, 12] },
  { name: "Appendix", pages: [13, 14, 15, 16, 17, 18, 19, 20, 21, 22] },
];

type LegendSlot = "top" | "overlay" | "right";

type Preset = {
  label: string;
  variant: SegmentLegendVariant;
  orientation: SegmentLegendOrientation;
  side?: SegmentLegendSide;
  slot: LegendSlot;
};

// Every way the legend can sit on the document. The page ribbon stays the left
// rail throughout; the legend takes the top, floats over the page, or runs down
// the right edge — so each is independent of the ribbon.
const PRESETS: Preset[] = [
  {
    label: "Bar",
    variant: "bar",
    orientation: "horizontal",
    side: "top",
    slot: "top",
  },
  {
    label: "Floating",
    variant: "floating",
    orientation: "horizontal",
    side: "top",
    slot: "overlay",
  },
  { label: "Rail", variant: "plain", orientation: "vertical", slot: "right" },
];

/**
 * The split viewer shown with every legend variant — a 2×2 gallery over one
 * ViT paper split result. Each cell is a real `PdfViewer` with the page
 * ribbon as a left rail and the `SegmentLegend` placed a different way; one
 * shared preview dims unrelated pages across all four at once.
 */
export function LegendVariantsBlock({ columns = 1 }: { columns?: 1 | 3 } = {}) {
  const segments = React.useMemo(() => toSegments(SPLIT_OUTPUT), []);
  const pageCount = React.useMemo(
    () => segmentsPageCount(segments),
    [segments],
  );
  const interaction = useSegmentInteraction();

  return (
    <div className="bg-background flex h-full min-h-[680px] flex-col">
      <div className="border-b px-6 py-3">
        <h2 className="text-base font-semibold">
          Split viewer · legend variants
        </h2>
        <p className="text-muted-foreground mt-0.5 text-sm">
          One split result, three legend placements — bar, floating, and a
          vertical rail.
        </p>
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-4">
        <div
          className={
            columns === 3
              ? "flex h-full min-h-0 flex-col gap-4 lg:flex-row"
              : "flex h-full min-h-0 flex-col gap-4"
          }
        >
          {PRESETS.map((preset) => (
            <Cell
              key={preset.label}
              preset={preset}
              segments={segments}
              pageCount={pageCount}
              interaction={interaction}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function Cell({
  preset,
  segments,
  pageCount,
  interaction,
}: {
  preset: Preset;
  segments: Segment[];
  pageCount: number;
  interaction: SegmentInteraction;
}) {
  const [currentPage, setCurrentPage] = React.useState<number | null>(1);
  const panelRef = React.useRef<HTMLDivElement | null>(null);

  const jumpToPage = React.useCallback((page: number) => {
    panelRef.current
      ?.querySelector<HTMLElement>(`[data-page-number="${page}"]`)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const onSelect = (segment: Segment) => {
    if (segment.pages.length) jumpToPage(segment.pages[0]);
  };

  const legend = (
    <SegmentLegend
      segments={segments}
      variant={preset.variant}
      orientation={preset.orientation}
      side={preset.side}
      density="compact"
      columns={preset.orientation === "horizontal" ? 2 : undefined}
      interaction={interaction}
      currentPage={currentPage}
      onSelect={onSelect}
    />
  );

  const ribbon = (
    <div className="border-border bg-background h-full overflow-auto border-r px-2 py-4">
      <PageRibbon
        orientation="vertical"
        rows={[{ id: "split", segments }]}
        pageCount={pageCount}
        currentPage={currentPage}
        interaction={interaction}
        onSelectPage={jumpToPage}
        showTicks
      />
    </div>
  );

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col space-y-1.5">
      <div className="flex flex-wrap items-baseline gap-x-2">
        <span className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
          {preset.label}
        </span>
        <code className="text-muted-foreground text-[11px]">
          variant=&quot;{preset.variant}&quot;
          {preset.orientation === "vertical" ? " · vertical" : ""}
        </code>
      </div>
      {/* The panel fills the remaining height (flex-1) and the page itself is
          held at A4 portrait (21/29.7), so its width is derived from that height
          and centered — never content-sized, which is what lets the `h-full`
          rails inside resolve. */}
      <div className="flex min-h-0 flex-1 justify-center">
        <div
          ref={panelRef}
          className="bg-card aspect-[21/29.7] h-full max-w-full overflow-hidden rounded-lg border"
        >
          <ViewerRoot className="h-full">
            <ViewerBody>
              <ViewerSidebar
                aria-label="Legend"
                collapsible="none"
                className="w-12"
              >
                {ribbon}
              </ViewerSidebar>
              <ViewerSurface className="relative">
                {preset.slot === "top" ? legend : null}
                <div className="relative flex min-h-0 flex-1">
                  <div className="relative min-h-0 flex-1">
                    <FileViewerProvider
                      source={{
                        kind: "url",
                        url: PDF_URL,
                        fileName: "an-image-is-worth-16x16-words.pdf",
                      }}
                    >
                      <FileViewer className="h-full">
                        <PdfViewerProvider>
                          <FileViewerBody>
                            <FileViewerSurface>
                              <FileViewerViewport>
                                <PdfViewerPages
                                  bare
                                  onVisiblePageChange={setCurrentPage}
                                  className="h-full"
                                />
                              </FileViewerViewport>
                            </FileViewerSurface>
                          </FileViewerBody>
                        </PdfViewerProvider>
                      </FileViewer>
                    </FileViewerProvider>
                    {preset.slot === "overlay" ? (
                      <div className="pointer-events-none absolute inset-x-3 top-3 z-10 [&>*]:pointer-events-auto">
                        {legend}
                      </div>
                    ) : null}
                  </div>
                  {preset.slot === "right" ? (
                    <aside className="border-border bg-background h-full w-40 overflow-auto border-l px-2 py-4">
                      {legend}
                    </aside>
                  ) : null}
                </div>
              </ViewerSurface>
            </ViewerBody>
          </ViewerRoot>
        </div>
      </div>
    </div>
  );
}
