"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import {
  ViewerBody,
  ViewerRoot,
  ViewerSidebar,
  ViewerSurface,
} from "@/components/ui/viewer"

import { EditViewerDocument } from "./edit-viewer-document"
import { EditViewerFields } from "./edit-viewer-fields"
import { EditViewerHeader } from "./edit-viewer-header"
import { EditViewerProvider, useEditViewer } from "./edit-viewer-provider"
import {
  EditViewerBusyOverlay as EditViewerBusyOverlayContent,
  EmptyEditViewerState,
} from "./edit-viewer-states"
import type { EditViewerProps } from "./edit-viewer-types"

export {
  EditViewerProvider,
  useEditViewer,
  useEditViewerDocument,
  useEditViewerFields,
  useEditViewerHeader,
  useEditViewerSelection,
} from "./edit-viewer-provider"
export type {
  EditViewerContextValue,
  EditViewerDocumentState,
  EditViewerFieldsPartState,
  EditViewerFieldsState,
  EditViewerHeaderState,
  EditViewerModeState,
  EditViewerProviderProps,
  EditViewerSelectionState,
  EditViewerState,
} from "./edit-viewer-provider"
export type { EditViewerDocumentTarget } from "./edit-viewer-model"
export { EditViewerDocument } from "./edit-viewer-document"
export type { EditViewerDocumentProps } from "./edit-viewer-document"
export { EditViewerFields } from "./edit-viewer-fields"
export type { EditViewerFieldsProps } from "./edit-viewer-fields"
export { EditViewerHeader } from "./edit-viewer-header"
export type { EditViewerHeaderProps } from "./edit-viewer-header"
export { EditViewerToolbar } from "./edit-viewer-toolbar"

export type {
  EditViewerField,
  EditViewerDocumentSource,
  EditViewerInputField,
  EditViewerInputResult,
  EditViewerMode,
  EditViewerOptions,
  EditViewerProps,
  EditViewerResult,
  EditViewerStatus,
} from "./edit-viewer-types"

export function EditViewer({ className, ...providerProps }: EditViewerProps) {
  return (
    <EditViewerProvider {...providerProps}>
      <EditViewerRoot className={className} />
    </EditViewerProvider>
  )
}

function EditViewerRoot({ className }: { className?: string }) {
  const edit = useEditViewer()

  return (
    <ViewerRoot
      bare
      data-edit-viewer-root
      defaultOpen
      className={cn("h-full w-full flex-1 bg-background", className)}
    >
      <EditViewerBusyOverlay />
      <EditViewerEmptyState />

      {edit.state.hasOutput ? (
        <>
          <EditViewerHeader />
          <ViewerBody className="flex-col md:flex-row">
            <ViewerSurface className="relative">
              <EditViewerDocument className="h-full" />
            </ViewerSurface>

            {edit.options.fieldPanel ? (
              <ViewerSidebar
                aria-label="Document fields"
                side="right"
                width="320px"
                className="max-h-[42%] min-h-[220px] border-t bg-background md:max-h-none md:max-w-[50%] md:border-t-0 md:border-l"
              >
                <EditViewerFields />
              </ViewerSidebar>
            ) : null}
          </ViewerBody>
        </>
      ) : null}
    </ViewerRoot>
  )
}

export function EditViewerBusyOverlay() {
  const { state } = useEditViewer()

  return state.status.state === "detecting" ||
    state.status.state === "filling" ? (
    <EditViewerBusyOverlayContent status={state.status} />
  ) : null
}

export function EditViewerEmptyState() {
  const { state } = useEditViewer()

  return state.hasOutput ? null : <EmptyEditViewerState />
}
