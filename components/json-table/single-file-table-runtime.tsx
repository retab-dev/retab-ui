"use client"

import React from "react"
import type { JSONSchema7 } from "json-schema"

import type { JsonTableCellHoverInfo } from "@/components/json-table/json-table-cell-types"
import type {
  JsonTableJsonEditMode,
  JsonTableSchemaEditMode,
} from "@/components/json-table/json-table-edit-modes"
import {
  recordJsonTableReactCommit,
  recordJsonTableRender,
} from "@/components/json-table/json-table-profiler"
import type { SingleFileTableDocumentModel } from "@/components/json-table/use-single-file-table-document-model"
import { useSingleFileTableProjectionModel } from "@/components/json-table/use-single-file-table-projection-model"
import { useSingleFileTableSchemaModel } from "@/components/json-table/use-single-file-table-schema-model"
import { useStableOptionalCallback } from "@/components/json-table/use-stable-optional-callback"

import { SingleFileVirtualizedTable } from "./single-file-virtualized-table"
import type { ColumnWidth } from "./table-options-store"

export interface SingleFileTableRuntimeProps {
  documentModel: SingleFileTableDocumentModel
  schema: JSONSchema7
  setSchema?: (schema: JSONSchema7) => void
  columnWidth?: ColumnWidth
  jsonEditMode: JsonTableJsonEditMode
  schemaEditMode: JsonTableSchemaEditMode
  onCellHoverStart?: (info: JsonTableCellHoverInfo) => void
  onCellHoverEnd?: () => void
  overscan?: number
  jumpOverscan?: number
}

function ignoreSchemaChange() {}

function areSingleFileTableRuntimePropsEqual(
  previousProps: SingleFileTableRuntimeProps,
  nextProps: SingleFileTableRuntimeProps
) {
  return (
    previousProps.documentModel === nextProps.documentModel &&
    previousProps.schema === nextProps.schema &&
    previousProps.setSchema === nextProps.setSchema &&
    previousProps.columnWidth === nextProps.columnWidth &&
    previousProps.jsonEditMode === nextProps.jsonEditMode &&
    previousProps.schemaEditMode === nextProps.schemaEditMode &&
    previousProps.overscan === nextProps.overscan &&
    previousProps.jumpOverscan === nextProps.jumpOverscan &&
    previousProps.onCellHoverStart === nextProps.onCellHoverStart &&
    previousProps.onCellHoverEnd === nextProps.onCellHoverEnd
  )
}

export const SingleFileTableRuntime = React.memo<SingleFileTableRuntimeProps>(
  ({
    documentModel,
    schema,
    setSchema,
    columnWidth: propColumnWidth,
    jsonEditMode,
    schemaEditMode,
    onCellHoverStart,
    onCellHoverEnd,
    overscan,
    jumpOverscan,
  }) => {
    const { projectionDocument } = documentModel
    const isJsonEditable = jsonEditMode === "editable"
    const stableSetSchema = useStableOptionalCallback<[JSONSchema7], void>(
      setSchema
    )
    const stableCellHoverStart = useStableOptionalCallback<
      [JsonTableCellHoverInfo],
      void
    >(onCellHoverStart)
    const stableCellHoverEnd = useStableOptionalCallback<[], void>(
      onCellHoverEnd
    )
    const schemaModel = useSingleFileTableSchemaModel({
      columnWidth: propColumnWidth,
      schema,
    })
    const projectionModel = useSingleFileTableProjectionModel({
      document: projectionDocument,
      isJsonEditable,
      visibleFieldMetadata: schemaModel.visibleFieldMetadata,
      visibleKeys: schemaModel.visibleKeys,
    })

    recordJsonTableRender("SingleFileTableView", projectionDocument.id, {
      columnWidth: propColumnWidth ?? null,
      jsonEditMode,
      schemaEditMode,
      hasUpdate: documentModel.canCommitDocument,
      jumpOverscan: jumpOverscan ?? null,
      overscan: overscan ?? null,
    })

    return (
      <div className="relative flex h-full min-h-0 w-full flex-1 flex-col">
        <div className="absolute inset-0 flex origin-top-left flex-col">
          <React.Profiler id="JsonTable" onRender={recordJsonTableReactCommit}>
            <SingleFileVirtualizedTable
              headerNodes={schemaModel.headerNodes}
              document={projectionDocument}
              schema={schema}
              setSchema={setSchema ? stableSetSchema : ignoreSchemaChange}
              isPublished={!setSchema}
              stopAt={schemaModel.stopAt}
              setStopAt={schemaModel.setStopAt}
              draggedItemKeyRef={schemaModel.draggedItemKeyRef}
              draggedItemParentPathRef={schemaModel.draggedItemParentPathRef}
              jsonEditMode={jsonEditMode}
              schemaEditMode={schemaEditMode}
              projectedRows={projectionModel.projectedRows}
              visibleColumns={schemaModel.visibleColumns}
              rowCount={projectionModel.rowCount}
              primitiveEditStore={documentModel.primitiveEditStore}
              onCellCommit={documentModel.onCellCommit}
              columnWidth={schemaModel.columnWidth}
              onCellHoverStart={
                onCellHoverStart ? stableCellHoverStart : undefined
              }
              onCellHoverEnd={onCellHoverEnd ? stableCellHoverEnd : undefined}
              overscan={overscan}
              jumpOverscan={jumpOverscan}
            />
          </React.Profiler>
        </div>
      </div>
    )
  },
  areSingleFileTableRuntimePropsEqual
)
SingleFileTableRuntime.displayName = "SingleFileTableRuntime"
