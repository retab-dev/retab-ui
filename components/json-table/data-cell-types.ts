import type { JSONSchema7 } from "json-schema"

import type { ProjectedCell } from "@/components/json-table/lib/document-projection"
import type { TableDocument } from "@/components/json-table/lib/projects-types"
import type { FieldMetadata } from "@/components/json-table/lib/schema-field-metadata"
import type { ColumnWidth } from "@/components/json-table/table-options-store"

export interface DataCellProps {
  templateFieldPath: string
  projectedCell?: ProjectedCell
  fieldMetadata?: FieldMetadata
  schema: JSONSchema7
  document: TableDocument
  docId: string
  columnWidth: ColumnWidth
  setOpenEditorPath: (key: string | null) => void
  openEditorPath: string | null
  onDocumentDataChange: (docId: string, value: unknown) => void
  onCellHoverStart?: (info: {
    docId: string
    fieldPath: string
    rect: DOMRect
  }) => void
  onCellHoverEnd?: () => void
  allowEditing?: boolean
}
