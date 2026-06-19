"use client";

import * as React from "react";

import { cn } from "@/lib/utils";
import {
  ViewerBody,
  ViewerRoot,
  ViewerSidebar,
  ViewerSurface,
} from "@/components/ui/viewer";
import type { ViewerHeader } from "@/components/ui/viewer";

import { EditViewerDocumentView } from "./edit-viewer-document";
import { EditViewerFieldsView } from "./edit-viewer-fields";
import { EditViewerHeaderView } from "./edit-viewer-header";
import { EditViewerProvider } from "./edit-viewer-provider";
import {
  EditViewerBusyOverlay as EditViewerBusyOverlayContent,
  EmptyEditViewerState,
} from "./edit-viewer-states";
import { useEditStore } from "./edit-viewer-store";
import type {
  EditViewerMode,
  EditViewerProps,
  EditViewerStatus,
} from "./edit-viewer-types";

type EditOutputState = {
  hasFieldPanel: boolean;
  hasOutput: boolean;
  busyStatus: Extract<
    EditViewerStatus,
    { state: "detecting" } | { state: "filling" }
  > | null;
};

type EditToolbarState = {
  hasFieldPanel: boolean;
  mode: EditViewerMode | null;
  modes: readonly EditViewerMode[];
  setMode: (mode: EditViewerMode) => void;
  status: Exclude<EditViewerStatus, { state: "idle" }> | null;
};

export type EditViewerHeaderProps = React.ComponentProps<typeof ViewerHeader>;

export type EditViewerDocumentProps = React.ComponentProps<"div">;

export type EditViewerFieldsProps = React.ComponentProps<"div">;

export function EditViewer({ className, ...providerProps }: EditViewerProps) {
  return (
    <EditViewerProvider {...providerProps}>
      <EditViewerRoot className={className} />
    </EditViewerProvider>
  );
}

function EditViewerRoot({ className }: { className?: string }) {
  const { hasFieldPanel, hasOutput } = useEditOutput();

  return (
    <ViewerRoot
      data-edit-viewer-root
      defaultOpen
      className={cn("bg-background h-full w-full flex-1", className)}
    >
      <EditViewerBusyOverlay />
      <EditViewerEmptyState />

      {hasOutput ? (
        <>
          <EditViewerHeader />
          <ViewerBody className="flex-col md:flex-row">
            <ViewerSurface className="relative">
              <EditViewerDocument className="h-full" />
            </ViewerSurface>

            {hasFieldPanel ? (
              <ViewerSidebar
                aria-label="Document fields"
                side="right"
                width="320px"
                className="bg-background max-h-[42%] min-h-[220px] border-t md:max-h-none md:max-w-[50%] md:border-t-0 md:border-l"
              >
                <EditViewerFields />
              </ViewerSidebar>
            ) : null}
          </ViewerBody>
        </>
      ) : null}
    </ViewerRoot>
  );
}

export function EditViewerHeader(props: EditViewerHeaderProps) {
  const edit = useEditToolbar();

  return (
    <EditViewerHeaderView
      {...props}
      hasFieldPanel={edit.hasFieldPanel}
      mode={edit.mode}
      modes={edit.modes}
      onModeChange={edit.setMode}
      status={edit.status}
    />
  );
}

export function EditViewerDocument({
  className,
  ...props
}: EditViewerDocumentProps) {
  const document = useEditStore().document;

  return (
    <EditViewerDocumentView
      {...props}
      className={className}
      target={document.target}
      renderPageOverlay={document.renderPageOverlay}
      viewerRef={document.viewerRef}
    />
  );
}

export function EditViewerFields(props: EditViewerFieldsProps) {
  const edit = useEditStore();
  const fields = {
    ...edit.fields,
    ...edit.selection,
  };

  return (
    <EditViewerFieldsView
      {...props}
      fieldGroups={fields.fieldGroups}
      fieldCount={fields.fieldCount}
      filledCount={fields.filledCount}
      visibleFieldCount={fields.visibleFieldCount}
      effectiveFieldKey={fields.activeFieldKey}
      selectedFieldKey={fields.selectedFieldKey}
      query={fields.query}
      onQueryChange={fields.setQuery}
      filter={fields.filter}
      onFilterChange={fields.setFilter}
      onFieldHover={fields.previewField}
      onFieldSelect={fields.selectField}
      showSearch={fields.canSearch}
      showFilters={fields.canFilter}
    />
  );
}

function EditViewerBusyOverlay() {
  const { busyStatus } = useEditOutput();

  return busyStatus ? (
    <EditViewerBusyOverlayContent status={busyStatus} />
  ) : null;
}

function EditViewerEmptyState() {
  const { hasOutput } = useEditOutput();

  return hasOutput ? null : <EmptyEditViewerState />;
}

function useEditOutput(): EditOutputState {
  const edit = useEditStore();
  const status = edit.state.status;
  return {
    busyStatus:
      status.state === "detecting" || status.state === "filling"
        ? status
        : null,
    hasFieldPanel: edit.options.fieldPanel,
    hasOutput: edit.state.hasOutput,
  };
}

function useEditToolbar(): EditToolbarState {
  const edit = useEditStore();
  return {
    hasFieldPanel: edit.options.fieldPanel,
    mode: edit.mode.mode,
    modes: edit.mode.modes,
    setMode: edit.mode.setMode,
    status: edit.state.status.state === "idle" ? null : edit.state.status,
  };
}
