"use client"

import { TextViewer } from "@/components/ui/text-viewer"

export function TextViewerDemo() {
  return (
    <div className="not-prose my-6 h-[460px] min-h-0">
      <TextViewer
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
