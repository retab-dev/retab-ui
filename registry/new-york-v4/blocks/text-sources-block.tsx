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
import { TextViewer, type TextViewerHandle } from "@/components/ui/text-viewer"
import {
  SourceFieldList,
  type SourceField,
} from "@/components/ui/source-field-list"
import { SourceIndicator } from "@/components/ui/source-indicator"
import { textAnchorToTarget } from "@/components/ui/text-source"
import textSample from "@/components/viewers/sample-data/text-sources.json"

const TEXT_URL = "/samples/extraction-run.log"

type TextField = SourceField & { source: Source }

const FIELDS = (textSample as TextField[]).map((field) => ({
  ...field,
  hint:
    field.source.anchor.kind === "text_span"
      ? `Line ${field.source.anchor.line_start}`
      : undefined,
}))
const ITEMS: AnchoredItem[] = FIELDS.map((field) => {
  const target = textAnchorToTarget(field.source.anchor)
  return {
    id: field.key,
    anchor: target
      ? {
          kind: "text-range",
          startLine: target.start,
          endLine: target.end,
        }
      : null,
  }
})

/**
 * Text sources block — values extracted from a log file, linked to the lines
 * they came from. Hovering a field highlights its line range and scrolls to it.
 * Same anchored-document abstraction, with the text viewer + its line-span
 * target adapter.
 */
export function TextSourcesBlock() {
  const viewerRef = React.useRef<TextViewerHandle>(null)
  const target = useTextAnchoredTarget(viewerRef)

  return (
    <AnchoredDocumentProvider
      items={ITEMS}
      target={target}
      initialItemId={FIELDS[0]?.key}
    >
      <TextSourcesContent viewerRef={viewerRef} />
    </AnchoredDocumentProvider>
  )
}

function TextSourcesContent({
  viewerRef,
}: {
  viewerRef: React.RefObject<TextViewerHandle | null>
}) {
  const link = useAnchoredFieldLink()
  const { activeAnchor, activeItem } = useAnchoredDocument()
  const highlight =
    activeAnchor?.kind === "text-range"
      ? {
          start: activeAnchor.startLine,
          end: activeAnchor.endLine,
        }
      : null

  return (
    <div className="flex h-full min-h-[680px] bg-background">
      <div className="relative min-w-0 flex-1">
        <TextViewer
          ref={viewerRef}
          source={{
            kind: "url",
            url: TEXT_URL,
            fileName: "extraction-run.log",
          }}
          bare
          className="h-full"
          highlight={highlight}
          mode="text"
        />
        <SourceIndicator path={link.activePath} found={!!activeItem?.anchor} />
      </div>
      <SourceFieldList fields={FIELDS} link={link} />
    </div>
  )
}

function useTextAnchoredTarget(
  viewerRef: React.RefObject<TextViewerHandle | null>
): AnchoredDocumentTarget {
  return React.useMemo(
    () => ({
      scrollToAnchor: (anchor, options) => {
        if (anchor.kind !== "text-range") return
        viewerRef.current?.scrollToLineRange(
          {
            start: anchor.startLine,
            end: anchor.endLine,
          },
          options
        )
      },
    }),
    [viewerRef]
  )
}
