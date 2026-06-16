"use client"

import { CodeViewer } from "@/components/ui/code-viewer"

export function CodeViewerDemo() {
  return (
    <div className="h-[460px]">
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
