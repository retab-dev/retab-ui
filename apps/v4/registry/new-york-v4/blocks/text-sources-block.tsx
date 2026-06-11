"use client"

import * as React from "react"

import type { Source, SourceMap } from "@/lib/document-source"
import { useSourceLink } from "@/hooks/use-source-link"
import {
  SourceFieldList,
  type SourceField,
} from "@/components/ui/source-field-list"
import { SourceIndicator } from "@/components/ui/source-indicator"
import {
  sourceToTextHighlight,
  useTextSourceTarget,
} from "@/components/ui/text-source"
import { TextViewer, type TextViewerHandle } from "@/components/ui/text-viewer"
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
const SOURCES: SourceMap = Object.fromEntries(
  FIELDS.map((field) => [field.key, field.source])
)

/**
 * Text sources block — values extracted from a log file, linked to the lines
 * they came from. Hovering a field highlights its line range and scrolls to it.
 * Same source-link abstraction, with the text viewer + its line-span adapter.
 */
export function TextSourcesBlock() {
  const viewerRef = React.useRef<TextViewerHandle>(null)
  const target = useTextSourceTarget(viewerRef)
  const link = useSourceLink({ sources: SOURCES, target })

  React.useEffect(() => {
    if (FIELDS[0]) link.selectField(FIELDS[0].key)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="flex h-full min-h-[680px] bg-background">
      <div className="relative min-w-0 flex-1">
        <TextViewer
          ref={viewerRef}
          src={TEXT_URL}
          bare
          downloadFileName="extraction-run.log"
          className="h-full"
          highlight={sourceToTextHighlight(link.activeSource)}
        />
        <SourceIndicator path={link.activePath} found={!!link.activeSource} />
      </div>
      <SourceFieldList fields={FIELDS} link={link} />
    </div>
  )
}
