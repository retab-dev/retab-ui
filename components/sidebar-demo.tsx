"use client";

import * as React from "react";

import { meanConfidence, toSegments } from "@/lib/segments";
import { FileViewerPreview } from "@/components/ui/file-viewer";
import { SegmentSidebar } from "@/components/ui/segment-sidebar";
import { useSegmentInteraction } from "@/components/ui/use-segment-interaction";
import {
  ViewerBody,
  ViewerHeader,
  ViewerRoot,
  ViewerSidebar,
  ViewerSidebarTrigger,
  ViewerSurface,
} from "@/components/ui/viewer";

const documentSegments = [
  { name: "Executive summary", pages: [1] },
  { name: "Risk factors", pages: [2, 3] },
  { name: "Use of proceeds", pages: [4] },
  { name: "Management discussion", pages: [5, 6, 7] },
  { name: "Financial statements", pages: [8, 9, 10, 11] },
  { name: "Signatures", pages: [12] },
];

const confidence = [0.98, 0.91, 0.87, 0.9, 0.84, 0.96];

export function ViewerSidebarDemo() {
  const [currentPage, setCurrentPage] = React.useState(1);
  const interaction = useSegmentInteraction();
  const segments = React.useMemo(
    () =>
      toSegments(
        documentSegments,
        confidence.map((value) => meanConfidence([value])),
      ),
    [],
  );

  return (
    <div
      className="not-prose bg-background h-[640px] overflow-hidden rounded-xl border"
      data-demo="viewer-sidebar"
    >
      <ViewerRoot
        defaultOpen
        mode="inline"
        sidebarCollapsible="offcanvas"
        className="bg-background h-full"
      >
        <ViewerHeader className="flex min-h-11 items-center gap-2 px-2">
          <ViewerSidebarTrigger className="-ml-1" />
          <div className="min-w-0">
            <div className="truncate text-sm font-medium">
              Prospectus review
            </div>
            <div className="text-muted-foreground truncate text-xs">
              ViewerSidebar owns the rail; SegmentSidebar owns the rows.
            </div>
          </div>
        </ViewerHeader>
        <ViewerBody>
          <ViewerSidebar
            aria-label="Document sections"
            className="bg-sidebar border-r"
            width="18rem"
          >
            <SegmentSidebar
              segments={segments}
              interaction={interaction}
              currentPage={currentPage}
              onSelect={(segment) => setCurrentPage(segment.pages[0] ?? 1)}
              unitLabel="section"
            />
          </ViewerSidebar>
          <ViewerSurface className="bg-background">
            <FileViewerPreview
              className="h-full"
              source={{
                kind: "url",
                url: "/samples/spacex-prospectus.pdf",
                fileName: "spacex-prospectus.pdf",
              }}
            />
          </ViewerSurface>
        </ViewerBody>
      </ViewerRoot>
    </div>
  );
}
