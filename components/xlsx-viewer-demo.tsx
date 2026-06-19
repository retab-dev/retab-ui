"use client";

import * as React from "react";

import { XlsxViewer } from "@/components/ui/xlsx-viewer";

export function XlsxViewerDemo() {
  return (
    <div className="h-[600px] min-h-0">
      <XlsxViewer
        source={{
          kind: "url",
          url: "/samples/nvidia-financials-fy2024.xlsx",
          fileName: "nvidia-financials-fy2024.xlsx",
        }}
        bare
        className="h-full"
        fallbackSheetTabs
        isolateStyles
      />
    </div>
  );
}
