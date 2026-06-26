"use client";

import dynamic from "next/dynamic";

import { cn } from "@/lib/utils";

const heroCanvasClassName =
  "h-[min(760px,calc(100svh-9rem))] min-h-[520px] rounded-lg";

const heroFrameClassName = "relative w-full max-w-[45rem]";

const DynamicFileViewerShowcase = dynamic(
  () =>
    import("@/components/file-viewer-demo").then(
      (mod) => mod.FileViewerShowcase,
    ),
  {
    ssr: false,
    loading: () => <FilesHeroFallback />,
  },
);

export function FilesHeroDemo() {
  return (
    <div className={heroFrameClassName}>
      <DynamicFileViewerShowcase
        canvasClassName={heroCanvasClassName}
        initialFileLabel="PDF"
        showPdfSidebar
        showTitle={false}
      />
    </div>
  );
}

function FilesHeroFallback() {
  const tabs = ["PDF", "Image", "XLSX", "DOCX", "CSV", "Code"];

  return (
    <div
      className={cn("flex flex-col gap-3", heroFrameClassName)}
      aria-hidden="true"
    >
      <div className="flex flex-wrap gap-[3px]">
        {tabs.map((tab, index) => (
          <div
            key={tab}
            className={cn(
              "h-7 rounded-md border px-3",
              index === 0 ? "bg-primary" : "bg-muted/60",
            )}
            style={{ width: `${Math.max(tab.length * 9, 42)}px` }}
          />
        ))}
      </div>
      <div
        className={cn(
          "bg-background w-full overflow-hidden border shadow-sm",
          heroCanvasClassName,
        )}
      >
        <div className="bg-muted/30 h-full w-full animate-pulse" />
      </div>
    </div>
  );
}
