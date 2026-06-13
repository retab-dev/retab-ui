"use client"

import { CodeViewer } from "@/components/ui/code-viewer"

export function CodeViewerDemo() {
  return (
    <div className="not-prose my-6 h-[460px] min-h-0">
      <CodeViewer
        source={{
          kind: "url",
          url: "/samples/server.log",
          fileName: "server.log",
          mimeType: "text/plain",
        }}
        className="h-full"
      />
    </div>
  )
}
