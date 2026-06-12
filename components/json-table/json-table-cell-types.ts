import type { JSONSchema7 } from "json-schema"

import type { FixedGridColumn } from "@/components/ui/fixed-grid-columns"
import type { ProjectedCell } from "@/components/json-table/lib/document-projection"
import type { TableDocument } from "@/components/json-table/lib/projects-types"
import type { FieldMetadata } from "@/components/json-table/lib/schema-field-metadata"

export interface VisibleColumn extends FixedGridColumn<FieldMetadata> {
  fieldMetadata?: FieldMetadata
}

export interface JsonTableCellProps {
  column: VisibleColumn
  projectedCell?: ProjectedCell
  schema: JSONSchema7
  document: TableDocument
  docId: string
  setOpenEditorPath: (key: string | null) => void
  openEditorPath: string | null
  onDocumentDataChange: (
    docId: string,
    materializedFieldPath: string,
    value: unknown
  ) => void
  isCellActive?: boolean
  onCellActivityLockChange?: (fieldPath: string, locked: boolean) => void
  isJsonEditable: boolean
}
