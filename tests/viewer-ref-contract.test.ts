import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const imperativeHandleFiles = [
  "components/viewers/page-markdown/page-markdown-document-pane.tsx",
  "components/viewers/page-markdown/page-markdown-pane.tsx",
  "registry/new-york-v4/ui/code-viewer-content.tsx",
  "registry/new-york-v4/ui/csv-viewer-grid.tsx",
  "registry/new-york-v4/ui/csv-viewer.tsx",
  "registry/new-york-v4/ui/docx-viewer-content.tsx",
  "registry/new-york-v4/ui/image-viewer-hooks.ts",
  "registry/new-york-v4/ui/markdown-document-viewer.tsx",
  "registry/new-york-v4/ui/pdf-viewer.tsx",
  "registry/new-york-v4/ui/text-viewer-chenglou-content.tsx",
  "registry/new-york-v4/ui/text-viewer-content.tsx",
  "registry/new-york-v4/ui/xlsx-viewer-session.tsx",
]

describe("viewer ref contract", () => {
  it("normalizes optional imperative refs before exposing viewer handles", () => {
    for (const file of imperativeHandleFiles) {
      const source = readFileSync(file, "utf8")

      expect(source, file).not.toMatch(
        /useImperativeHandle\(\s*(?:forwardedRef|ref)\s*,/
      )
    }
  })
})
