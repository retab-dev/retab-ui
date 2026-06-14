"use client"

import * as React from "react"

import type { Source } from "@/lib/document-source"
import {
  AnchoredDocumentProvider,
  type AnchoredDocumentTarget,
  type AnchoredItem,
  useAnchoredDocument,
  useAnchoredFieldLink,
} from "@/components/ui/anchored-document-viewer"
import {
  docxAnchorToTarget,
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
const ITEMS: AnchoredItem[] = FIELDS.map((field) => {
  const target = docxAnchorToTarget(field.source.anchor, field.source)
  return {
    id: field.key,
    anchor: target
      ? {
          kind: "docx-target",
          target,
        }
      : null,
  }
})

/**
 * DOCX sources block — values extracted from a Word document, linked to where
 * they came from. Hovering a field highlights its text in the document and
 * scrolls to it. Same anchored-document abstraction as the other formats, with
 * the docx viewer target adapter.
 */
export function DocxSourcesBlock() {
  const viewerRef = React.useRef<DocxViewerHandle>(null)
  const target = useDocxAnchoredTarget(viewerRef)

  return (
    <AnchoredDocumentProvider
      items={ITEMS}
      target={target}
      initialItemId={FIELDS[0]?.key}
    >
      <DocxSourcesContent viewerRef={viewerRef} />
    </AnchoredDocumentProvider>
  )
}

function DocxSourcesContent({
  viewerRef,
}: {
  viewerRef: React.RefObject<DocxViewerHandle | null>
}) {
  const link = useAnchoredFieldLink()
  const { activeAnchor, activeItem } = useAnchoredDocument()
  const highlight =
    activeAnchor?.kind === "docx-target" ? activeAnchor.target : null

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
          highlight={highlight}
        />
        <SourceIndicator path={link.activePath} found={!!activeItem?.anchor} />
      </div>
      <SourceFieldList fields={FIELDS} link={link} />
    </div>
  )
}

function useDocxAnchoredTarget(
  viewerRef: React.RefObject<DocxViewerHandle | null>
): AnchoredDocumentTarget {
  return React.useMemo(
    () => ({
      scrollToAnchor: (anchor, options) => {
        if (anchor.kind !== "docx-target") return
        viewerRef.current?.scrollToTarget(anchor.target, options)
      },
    }),
    [viewerRef]
  )
}
