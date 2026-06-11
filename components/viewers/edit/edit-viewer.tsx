"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import type { PageOverlayProps } from "@/components/ui/pdf-viewer"

import { EditViewerDocumentPane } from "./edit-viewer-document-pane"
import { EditViewerFieldPanel } from "./edit-viewer-field-panel"
import { EditFieldOverlayLayer } from "./edit-viewer-overlays"
import {
  EditViewerBusyOverlay,
  EmptyEditViewerState,
} from "./edit-viewer-states"
import { EditViewerToolbar } from "./edit-viewer-toolbar"
import type { EditViewerProps } from "./edit-viewer-types"
import { useEditViewerController } from "./use-edit-viewer-controller"

export type {
  EditViewerDocument,
  EditViewerFeatures,
  EditViewerField,
  EditViewerMode,
  EditViewerProps,
  EditViewerResult,
  EditViewerStatus,
} from "./edit-viewer-types"

export function EditViewer({
  result,
  sourceDocument,
  filledDocument,
  mode,
  onModeChange,
  selectedFieldKey,
  onSelectedFieldKeyChange,
  status = { state: "idle" },
  className,
  features,
}: EditViewerProps) {
  const controller = useEditViewerController({
    result,
    sourceDocument,
    filledDocument,
    mode,
    onModeChange,
    selectedFieldKey,
    onSelectedFieldKeyChange,
    status,
    features,
  })

  const renderPageOverlay = React.useCallback(
    ({ pageNumber }: PageOverlayProps) => (
      <EditFieldOverlayLayer
        fields={controller.fields}
        pageNumber={pageNumber}
        mode={controller.activeMode}
        effectiveFieldKey={controller.effectiveFieldKey}
        onFieldHover={controller.setHoveredFieldKey}
        onFieldSelect={controller.selectField}
      />
    ),
    [
      controller.activeMode,
      controller.effectiveFieldKey,
      controller.fields,
      controller.selectField,
      controller.setHoveredFieldKey,
    ]
  )

  return (
    <div
      data-edit-viewer-root
      className={cn(
        "relative flex min-h-0 w-full flex-1 flex-col overflow-hidden bg-background md:flex-row",
        className
      )}
    >
      {status.state === "detecting" || status.state === "filling" ? (
        <EditViewerBusyOverlay status={status} />
      ) : null}

      {!controller.hasOutput ? (
        <EmptyEditViewerState />
      ) : (
        <>
          <div className="relative flex min-w-0 flex-1 flex-col">
            <EditViewerToolbar
              modes={controller.availableModes}
              mode={controller.activeMode}
              onModeChange={controller.changeMode}
              filledCount={controller.filledCount}
              fieldCount={controller.fields.length}
              status={controller.activeStatus}
            />
            <div className="relative min-h-0 flex-1">
              <EditViewerDocumentPane
                mode={controller.activeMode}
                sourceDocument={sourceDocument}
                filledDocument={filledDocument}
                renderPageOverlay={renderPageOverlay}
                viewerRef={controller.viewerRef}
                status={status}
              />
            </div>
          </div>

          {controller.resolvedFeatures.fieldPanel ? (
            <EditViewerFieldPanel
              fields={controller.fields}
              filledCount={controller.filledCount}
              effectiveFieldKey={controller.effectiveFieldKey}
              selectedFieldKey={controller.selectedFieldKey}
              query={controller.query}
              onQueryChange={controller.setQuery}
              filter={controller.filter}
              onFilterChange={controller.setFilter}
              onFieldHover={controller.setHoveredFieldKey}
              onFieldSelect={controller.selectField}
              showSearch={controller.resolvedFeatures.search}
              showFilters={controller.resolvedFeatures.filters}
            />
          ) : null}
        </>
      )}
    </div>
  )
}
