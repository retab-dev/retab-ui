"use client"

import { FileViewer } from "@/components/ui/file-viewer"

export function HtmlViewerDemo() {
  return (
    <div className="not-prose my-6 h-[540px] min-h-0">
      <FileViewer
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
  )
}
