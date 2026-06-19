"use client";

import { CodeViewer } from "@/components/ui/code-viewer";

export function CodeViewerDemo() {
  return (
    <div className="h-[460px] min-h-0">
      <CodeViewer
        source={{
          kind: "url",
          url: "/samples/server.log",
          fileName: "server.log",
          mimeType: "text/plain",
        }}
        bare
        className="h-full"
      />
    </div>
  );
}
