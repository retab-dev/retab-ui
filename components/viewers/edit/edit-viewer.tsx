"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import {
  AnchoredDocumentProvider,
  type AnchoredItem,
  useAnchoredDocument,
} from "@/components/ui/anchored-document-viewer"
import { usePdfAnchoredTarget } from "@/components/ui/pdf-anchor-target"
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
import type { EditViewerField, EditViewerProps } from "./edit-viewer-types"
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
    status,
    options,
  })
  const target = usePdfAnchoredTarget(controller.viewerRef)
  const anchoredItems = React.useMemo(
    () => controller.fields.map(editFieldToAnchoredItem),
    [controller.fields]
  )

  return (
    <AnchoredDocumentProvider
      items={anchoredItems}
      target={target}
      initialItemId={selectedFieldKey}
    >
      <EditViewerContent
        className={className}
        controller={controller}
        filledDocument={filledDocument}
        onSelectedFieldKeyChange={onSelectedFieldKeyChange}
        selectedFieldKey={selectedFieldKey}
        sourceDocument={sourceDocument}
        status={status}
      />
    </AnchoredDocumentProvider>
  )
}

function EditViewerContent({
  className,
  controller,
  filledDocument,
  onSelectedFieldKeyChange,
  selectedFieldKey,
  sourceDocument,
  status,
}: {
  className?: string
  controller: ReturnType<typeof useEditViewerController>
  filledDocument?: EditViewerProps["filledDocument"]
  onSelectedFieldKeyChange?: EditViewerProps["onSelectedFieldKeyChange"]
  selectedFieldKey?: EditViewerProps["selectedFieldKey"]
  sourceDocument?: EditViewerProps["sourceDocument"]
  status: NonNullable<EditViewerProps["status"]>
}) {
  const {
    activeItemId,
    activateItem,
    previewItem,
    selectedItemId,
    selectItem,
  } = useAnchoredDocument()

  React.useEffect(() => {
    if (selectedFieldKey === undefined) return
    if (selectedFieldKey && !controller.fieldByKey.has(selectedFieldKey)) {
      selectItem(null)
      onSelectedFieldKeyChange?.(null)
      return
    }
    selectItem(selectedFieldKey ?? null)
  }, [
    controller.fieldByKey,
    onSelectedFieldKeyChange,
    selectItem,
    selectedFieldKey,
  ])

  const selectField = React.useCallback(
    (fieldKey: string) => {
      activateItem(fieldKey)
      onSelectedFieldKeyChange?.(fieldKey)
    },
    [activateItem, onSelectedFieldKeyChange]
  )

  const renderPageOverlay = React.useCallback(
    ({ pageNumber }: PageOverlayProps) => (
      <EditFieldOverlayLayer
        fieldsByPage={controller.fieldsByPage}
        pageNumber={pageNumber}
        mode={controller.activeMode}
        effectiveFieldKey={activeItemId}
        onFieldHover={previewItem}
        onFieldSelect={selectField}
      />
    ),
    [
      activeItemId,
      controller.activeMode,
      controller.fieldsByPage,
      previewItem,
      selectField,
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
                  effectiveFieldKey={activeItemId}
                  selectedFieldKey={selectedItemId}
                  query={controller.query}
                  onQueryChange={controller.setQuery}
                  filter={controller.filter}
                  onFilterChange={controller.setFilter}
                  onFieldHover={previewItem}
                  onFieldSelect={selectField}
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

function editFieldToAnchoredItem(field: EditViewerField): AnchoredItem {
  return {
    id: field.key,
    anchor: field.bbox
      ? {
          kind: "pdf-area",
          pageNumber: field.bbox.page,
          left: field.bbox.left * 100,
          top: field.bbox.top * 100,
          width: field.bbox.width * 100,
          height: field.bbox.height * 100,
        }
      : null,
  }
}
