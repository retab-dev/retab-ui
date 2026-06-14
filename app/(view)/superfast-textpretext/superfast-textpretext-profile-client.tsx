"use client"

import { SuperfastTextpretext } from "@/components/ui/superfast-textpretext"
import {
  LONG_TEXT_SAMPLE,
  LONG_TEXT_SAMPLE_FILE_NAME,
  LONG_TEXT_SAMPLE_MIME_TYPE,
} from "@/components/long-text-sample"

export function SuperfastTextpretextProfileClient() {
  return (
    <main className="h-screen bg-background p-4 text-foreground">
      <div className="mb-3 flex items-center justify-between">
        <h1 className="text-sm font-medium">Superfast Textpretext Profile</h1>
        <span className="text-xs text-muted-foreground">native chunks</span>
      </div>
      <section className="h-[calc(100vh-56px)]" data-profile-root="superfast">
        <SuperfastTextpretext
          bare
          toolbar={false}
          highlight={{ start: 1, end: 3 }}
          source={{
            kind: "text",
            text: LONG_TEXT_SAMPLE,
            fileName: LONG_TEXT_SAMPLE_FILE_NAME,
            mimeType: LONG_TEXT_SAMPLE_MIME_TYPE,
          }}
        />
      </section>
    </main>
  )
}
