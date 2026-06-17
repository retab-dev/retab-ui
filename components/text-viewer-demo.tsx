"use client"

import { TextViewer } from "@/components/ui/text-viewer"
import {
  LONG_TEXT_SAMPLE,
  LONG_TEXT_SAMPLE_FILE_NAME,
  LONG_TEXT_SAMPLE_MIME_TYPE,
} from "@/components/long-text-sample"

export function TextViewerDemo() {
  return (
    <div className="h-[620px] min-h-0">
      <TextViewer
        source={{
          kind: "text",
          text: LONG_TEXT_SAMPLE,
          fileName: LONG_TEXT_SAMPLE_FILE_NAME,
          mimeType: LONG_TEXT_SAMPLE_MIME_TYPE,
        }}
        bare
        className="h-full"
        highlight={{ start: 1, end: 3 }}
      />
    </div>
  )
}
