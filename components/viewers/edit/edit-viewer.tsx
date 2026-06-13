"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import type { PageOverlayProps } from "@/components/ui/pdf-viewer"
import {
  ViewerBody,
  ViewerHeader,
  ViewerRoot,
  ViewerSidebar,
  ViewerSurface,
} from "@/components/ui/viewer"

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
  EditViewerField,
  EditViewerInputField,
  EditViewerInputResult,
  EditViewerMode,
  EditViewerOptions,
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
  options,
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
    options,
  })

  const renderPageOverlay = React.useCallback(
    ({ pageNumber }: PageOverlayProps) => (
      <EditFieldOverlayLayer
        fieldsByPage={controller.fieldsByPage}
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
      controller.fieldsByPage,
      controller.selectField,
      controller.setHoveredFieldKey,
    ]
  )

  return (
    <ViewerRoot
      bare
      data-edit-viewer-root
      className={cn("h-full w-full flex-1 bg-background", className)}
    >
      {status.state === "detecting" || status.state === "filling" ? (
        <EditViewerBusyOverlay status={status} />
      ) : null}

      {!controller.hasOutput ? (
        <EmptyEditViewerState />
      ) : (
        <>
          {controller.availableModes.length > 0 ? (
            <ViewerHeader className="bg-background">
              <EditViewerToolbar
                modes={controller.availableModes}
                mode={controller.activeMode}
                onModeChange={controller.changeMode}
                filledCount={controller.filledCount}
                fieldCount={controller.fields.length}
                status={controller.activeStatus}
              />
            </ViewerHeader>
          ) : null}

          <ViewerBody className="flex-col md:flex-row">
            <ViewerSurface className="relative">
              <EditViewerDocumentPane
                mode={controller.activeMode}
                sourceDocument={sourceDocument}
                filledDocument={filledDocument}
                renderPageOverlay={renderPageOverlay}
                viewerRef={controller.viewerRef}
                status={status}
              />
            </ViewerSurface>

            {controller.resolvedOptions.fieldPanel ? (
              <ViewerSidebar className="max-h-[42%] min-h-[220px] border-t bg-background md:max-h-none md:w-[320px] md:max-w-[50%] md:border-t-0 md:border-l">
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
                  showSearch={controller.resolvedOptions.search}
                  showFilters={controller.resolvedOptions.filters}
                />
              </ViewerSidebar>
            ) : null}
          </ViewerBody>
        </>
      )}
    </ViewerRoot>
  )
}
