"use client"

import * as React from "react"

import type { Source, SourceMap } from "@/lib/document-source"
import { useSourceLink } from "@/hooks/use-source-link"
import {
  sourceToDocxHighlight,
  useDocxSourceTarget,
} from "@/components/ui/docx-source"
import { DocxViewer, type DocxViewerHandle } from "@/components/ui/docx-viewer"
import {
  SourceFieldList,
  type SourceField,
} from "@/components/ui/source-field-list"
import { SourceIndicator } from "@/components/ui/source-indicator"
import docxSample from "@/components/viewers/sample-data/docx-sources.json"

const DOCX_URL = "/samples/quarterly-business-review.docx"

type DocxField = SourceField & { source: Source }

/** A short locator hint per anchor kind, matching the other source blocks. */
function hintFor(source: Source): string | undefined {
  const a = source.anchor
  if (a.kind === "docx_text_span") return `¶ ${a.paragraph + 1}`
  if (a.kind === "docx_table_cell")
    return `Table ${a.table + 1} · R${a.row + 1}C${a.column + 1}`
  return undefined
}

const FIELDS = (docxSample as DocxField[]).map((field) => ({
  ...field,
  hint: hintFor(field.source),
}))
const SOURCES: SourceMap = Object.fromEntries(
  FIELDS.map((field) => [field.key, field.source])
)

/**
 * DOCX sources block — values extracted from a Word document, linked to where
 * they came from. Hovering a field highlights its text in the document and
 * scrolls to it. Same source-link abstraction as the other formats, with the
 * docx viewer + its content-match / table-index adapter.
 */
export function DocxSourcesBlock() {
  const viewerRef = React.useRef<DocxViewerHandle>(null)
  const target = useDocxSourceTarget(viewerRef)
  const link = useSourceLink({
    sources: SOURCES,
    target,
    initialField: FIELDS[0]?.key,
  })

  return (
    <div className="flex h-full min-h-[680px] bg-background">
      <div className="relative min-w-0 flex-1">
        <DocxViewer
          ref={viewerRef}
          source={{
            kind: "url",
            url: DOCX_URL,
            fileName: "quarterly-business-review.docx",
          }}
          bare
          className="h-full"
          highlight={sourceToDocxHighlight(link.activeSource)}
        />
        <SourceIndicator path={link.activePath} found={!!link.activeSource} />
      </div>
      <SourceFieldList fields={FIELDS} link={link} />
    </div>
  )
}
