"use client";

import * as React from "react";

import {
  FileViewer,
  FileViewerContent,
  FileViewerControls,
  FileViewerDocument,
  FileViewerHeader,
  FileViewerInset,
  FileViewerProvider,
  FileViewerSidebar,
  FileViewerSidebarContent,
  FileViewerSidebarTrigger,
  FileViewerTitle,
  FileViewerViewport,
} from "@/components/ui/file-viewer";

const SLIDE_COUNT = 23;

export default function PptxSidebarTransitionPage() {
  const source = React.useMemo(
    () => ({
      kind: "url" as const,
      url: "/samples/sample-presentation.pptx",
      fileName: "sample-presentation.pptx",
    }),
    [],
  );

  return (
    <main className="bg-background h-svh p-6">
      <div className="h-full overflow-hidden rounded-xl border shadow-sm">
        <FileViewerProvider
          source={source}
          defaultSidebarOpen
          fallbackSlideSize={{ width: 960, height: 540 }}
          isolateStyles
        >
          <FileViewer className="h-full">
            <FileViewerHeader>
              <FileViewerSidebarTrigger className="-ms-1" />
              <FileViewerTitle />
              <FileViewerControls />
            </FileViewerHeader>
            <FileViewerContent>
              <FileViewerSidebar
                aria-label="Presentation slides"
                width="240px"
                className="border-r bg-transparent"
              >
                <FileViewerSidebarContent className="p-3">
                  <div className="grid gap-1">
                    {Array.from({ length: SLIDE_COUNT }, (_, index) => (
                      <div
                        key={index}
                        className="text-muted-foreground rounded-md border px-2 py-1.5 text-xs"
                      >
                        Slide {index + 1}
                      </div>
                    ))}
                  </div>
                </FileViewerSidebarContent>
              </FileViewerSidebar>
              <FileViewerInset align="center">
                <FileViewerViewport>
                  <FileViewerDocument />
                </FileViewerViewport>
              </FileViewerInset>
            </FileViewerContent>
          </FileViewer>
        </FileViewerProvider>
      </div>
    </main>
  );
}
