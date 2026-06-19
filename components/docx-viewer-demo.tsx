"use client";

import * as React from "react";

import { DocxViewer } from "@/components/ui/docx-viewer";

export function DocxViewerDemo() {
  return (
    // A 25-page report (explicit page breaks; the rendered count matches the
    // document's own page count) so off-screen page skipping shows at scale.
    <div className="h-[600px] min-h-0">
      <DocxViewer
        source={{
          kind: "url",
          url: "/samples/quarterly-business-review.docx",
          fileName: "quarterly-business-review.docx",
        }}
        bare
        className="h-full"
      />
    </div>
  );
}
