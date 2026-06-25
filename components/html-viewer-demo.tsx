"use client";

import { FileViewerPreview } from "@/components/ui/file-viewer";

export function HtmlViewerDemo() {
  return (
    <div className="h-[540px] min-h-0">
      <FileViewerPreview
        source={{
          kind: "url",
          url: "/samples/welcome.html",
          fileName: "welcome.html",
          mimeType: "text/html",
        }}
        className="h-full"
        isolateStyles
      />
    </div>
  );
}
