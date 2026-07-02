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

const SECTIONS = [
  "Release Notes",
  "Rich Markdown",
  "Viewer Coverage",
  "Markdown Checklist",
  "Rollout Metrics",
  "Footnotes",
];

export default function MarkdownSidebarTransitionPage() {
  const source = React.useMemo(
    () => ({
      kind: "url" as const,
      url: "/samples/release-notes.md",
      fileName: "release-notes.md",
      mimeType: "text/markdown",
    }),
    [],
  );

  return (
    <main className="bg-background h-svh p-6">
      <div className="h-full overflow-hidden rounded-xl border shadow-sm">
        <FileViewerProvider source={source} defaultSidebarOpen isolateStyles>
          <FileViewer className="h-full">
            <FileViewerHeader>
              <FileViewerSidebarTrigger className="-ms-1" />
              <FileViewerTitle />
              <FileViewerControls />
            </FileViewerHeader>
            <FileViewerContent>
              <FileViewerSidebar
                aria-label="Markdown outline"
                width="240px"
                className="border-r bg-transparent"
              >
                <FileViewerSidebarContent className="p-3">
                  <div className="grid gap-1">
                    {SECTIONS.map((section) => (
                      <div
                        key={section}
                        className="text-muted-foreground rounded-md border px-2 py-1.5 text-xs"
                      >
                        {section}
                      </div>
                    ))}
                  </div>
                </FileViewerSidebarContent>
              </FileViewerSidebar>
              <FileViewerInset align="start">
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
