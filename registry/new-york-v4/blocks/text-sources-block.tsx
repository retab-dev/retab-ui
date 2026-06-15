"use client"

import * as React from "react"

import type { Source } from "@/lib/document-source"
import { SegmentedDocumentProvider } from "@/components/ui/segmented-document-provider"
import { useSegmentedSourceFieldLink } from "@/components/ui/source-field-link"
import {
  SourceFieldList,
  type SourceField,
} from "@/components/ui/source-field-list"
import { SourceIndicator } from "@/components/ui/source-indicator"
import { sourceFieldsToSegmentedDocumentModel } from "@/components/ui/source-segmented-document-model"
import {
  sourceToTextHighlight,
  useTextSourceTarget,
} from "@/components/ui/text-source"
import { TextViewer, type TextViewerHandle } from "@/components/ui/text-viewer"
import {
  ViewerBody,
  ViewerRoot,
  ViewerSidebar,
  ViewerSurface,
} from "@/components/ui/viewer"
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
const FIELD_BY_KEY = new Map(FIELDS.map((field) => [field.key, field]))
const SEGMENTED_DOCUMENT = sourceFieldsToSegmentedDocumentModel(
  FIELDS.map((field) => ({
    id: field.key,
    label: field.label,
    source: field.source,
  }))
)

/**
 * Text sources block — values extracted from a log file, linked to the lines
 * they came from. Hovering a field highlights its line range and scrolls to it.
 * Segmented source interaction owns field preview/selection while the text
 * source adapter owns line-range scrolling and highlighting.
 */
export function TextSourcesBlock() {
  const viewerRef = React.useRef<TextViewerHandle>(null)

  return (
    <SegmentedDocumentProvider model={SEGMENTED_DOCUMENT}>
      <TextSourcesContent viewerRef={viewerRef} />
    </SegmentedDocumentProvider>
  )
}

function TextSourcesContent({
  viewerRef,
}: {
  viewerRef: React.RefObject<TextViewerHandle | null>
}) {
  const target = useTextSourceTarget(viewerRef)
  const segmentedLink = useSegmentedSourceFieldLink({
    initialPath: FIELDS[0]?.key,
  })
  const link = useTargetedSourceFieldLink({
    fieldByKey: FIELD_BY_KEY,
    link: segmentedLink,
    target,
  })
  const activeSource = link.activePath
    ? FIELD_BY_KEY.get(link.activePath)?.source
    : undefined
  const highlight = sourceToTextHighlight(activeSource)

  return (
    <ViewerRoot bare className="h-full min-h-[680px] bg-background">
      <ViewerBody>
        <ViewerSurface className="relative">
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
          <SourceIndicator path={link.activePath} found={!!activeSource} />
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

function useTargetedSourceFieldLink({
  fieldByKey,
  link,
  target,
}: {
  fieldByKey: ReadonlyMap<string, TextField>
  link: ReturnType<typeof useSegmentedSourceFieldLink>
  target: ReturnType<typeof useTextSourceTarget>
}) {
  const scrollToField = React.useCallback(
    (path: string, behavior: ScrollBehavior) => {
      const source = fieldByKey.get(path)?.source
      if (source) target.scrollTo?.(source, { behavior })
    },
    [fieldByKey, target]
  )
  const onFieldHover = React.useCallback(
    (path: string | null) => {
      link.onFieldHover(path)
      if (path) scrollToField(path, "auto")
    },
    [link, scrollToField]
  )
  const selectField = React.useCallback(
    (path: string) => {
      link.selectField?.(path)
      scrollToField(path, "smooth")
    },
    [link, scrollToField]
  )

  return React.useMemo(
    () => ({
      ...link,
      onFieldHover,
      selectField,
    }),
    [link, onFieldHover, selectField]
  )
}
