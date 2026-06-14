"use client"

import type { JSONSchema7 } from "json-schema"

import type { JsonTableCellHoverInfo } from "@/components/json-table/json-table-cell-types"
import type {
  JsonTableJsonEditMode,
  JsonTableSchemaEditMode,
} from "@/components/json-table/json-table-edit-modes"
import type { TableDocument } from "@/components/json-table/lib/projects-types"
import { SingleFileTableRuntime } from "@/components/json-table/single-file-table-runtime"
import type { ColumnWidth } from "@/components/json-table/table-options-store"
import {
  type SingleFileTableDocumentPatch,
  useSingleFileTableDocumentModel,
} from "@/components/json-table/use-single-file-table-document-model"

export type {
  JsonTableJsonEditMode,
  JsonTableSchemaEditMode,
} from "@/components/json-table/json-table-edit-modes"

interface SingleFileTableViewProps {
  document: TableDocument
  schema: JSONSchema7
  setSchema?: (schema: JSONSchema7) => void
  columnWidth?: ColumnWidth
  onUpdateDocument?: (patch: SingleFileTableDocumentPatch) => Promise<void>
  jsonEditMode: JsonTableJsonEditMode
  schemaEditMode: JsonTableSchemaEditMode
  onCellHoverStart?: (info: JsonTableCellHoverInfo) => void
  onCellHoverEnd?: () => void
  overscan?: number
  jumpOverscan?: number
}

export function SingleFileTableView({
  document,
  onUpdateDocument,
  ...props
}: SingleFileTableViewProps) {
  const documentModel = useSingleFileTableDocumentModel({
    sourceDocument: document,
    onUpdateDocument,
  })

  return <SingleFileTableRuntime {...props} documentModel={documentModel} />
}
