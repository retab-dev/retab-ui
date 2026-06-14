"use client"

import * as React from "react"

import type { Source } from "@/lib/document-source"
import {
  AnchoredDocumentProvider,
  useAnchoredDocument,
  type AnchoredDocumentTarget,
} from "@/components/ui/anchored-document-viewer"
import { DocxViewer, type DocxViewerHandle } from "@/components/ui/docx-viewer"
import { useAnchoredFieldLink } from "@/components/ui/field-anchor-link"
import { sourceFieldsToEvidenceModel } from "@/components/ui/source-evidence"
import {
  SourceFieldList,
  type SourceField,
} from "@/components/ui/source-field-list"
import { SourceIndicator } from "@/components/ui/source-indicator"
import {
  ViewerBody,
  ViewerRoot,
  ViewerSidebar,
  ViewerSurface,
} from "@/components/ui/viewer"
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
const EVIDENCE = sourceFieldsToEvidenceModel(FIELDS)

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
      items={EVIDENCE.anchoredItems}
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
    <ViewerRoot bare className="h-full min-h-[680px] bg-background">
      <ViewerBody>
        <ViewerSurface className="relative">
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
          <SourceIndicator
            path={link.activePath}
            found={!!activeItem?.anchor}
          />
        </ViewerSurface>
        <ViewerSidebar
          aria-label="Source fields"
          side="right"
          collapsible="none"
          width="360px"
          className="border-l"
        >
          <SourceFieldList fields={FIELDS} link={link} />
        </ViewerSidebar>
      </ViewerBody>
    </ViewerRoot>
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
