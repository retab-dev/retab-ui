"use client"

import { SuperfastTextpretext } from "@/components/ui/superfast-textpretext"
import {
  LONG_TEXT_SAMPLE,
  LONG_TEXT_SAMPLE_FILE_NAME,
  LONG_TEXT_SAMPLE_MIME_TYPE,
} from "@/components/long-text-sample"

export function SuperfastTextpretextDemo() {
  return (
    <div className="not-prose my-6 h-[620px] min-h-0">
      <SuperfastTextpretext
        source={{
          kind: "text",
          text: LONG_TEXT_SAMPLE,
          fileName: LONG_TEXT_SAMPLE_FILE_NAME,
          mimeType: LONG_TEXT_SAMPLE_MIME_TYPE,
        }}
        className="h-full"
        highlight={{ start: 1, end: 3 }}
      />
    </div>
  )
}
