import * as React from "react"
import { useState } from "react"

import { TableCell } from "@/components/ui/table"
import { CellEditor } from "@/components/json-table/cell-editors/cell-editor"
import {
  getCellWidthStyle,
  getSelectableCellWidthStyle,
  interactiveCellOverlayClass,
} from "@/components/json-table/cell-style"
import type { JsonTableCellProps } from "@/components/json-table/json-table-cell-types"
import { JsonTableDisplayCell } from "@/components/json-table/json-table-display-cell"
import { JsonTableScalarCell } from "@/components/json-table/json-table-scalar-cell"
import { getFieldMetadata } from "@/components/json-table/lib/schema-field-metadata"
import type { FieldMetadata } from "@/components/json-table/lib/schema-field-metadata"
import { formatValueForCommit } from "@/components/json-table/lib/value-normalization"
import { cmp, useRefCallback } from "@/components/json-table/path-utils"
import { useCellController } from "@/components/json-table/use-cell-controller"
import { useElevatedVirtualRow } from "@/components/json-table/use-elevated-virtual-row"

function editableCellMemoVariables(props: JsonTableCellProps) {
  const { document, ...rest } = props
  const materializedFieldPath = props.projectedCell?.materializedFieldPath
  return { ...rest, materializedFieldPath, document }
}

function ActiveEditableJsonTableCell({
  docId,
  document,
  fieldMetadata,
  materializedFieldPath,
  openEditorPath,
  schema,
  setOpenEditorPath,
  value,
  onActivityLockChange,
  onDocumentDataChange,
}: {
  docId: string
  document: JsonTableCellProps["document"]
  fieldMetadata: FieldMetadata
  materializedFieldPath: string
  openEditorPath: string | null
  schema: JsonTableCellProps["schema"]
  setOpenEditorPath: (path: string | null) => void
  value: unknown
  onActivityLockChange: (locked: boolean) => void
  onDocumentDataChange: JsonTableCellProps["onDocumentDataChange"]
}) {
  const { effectiveValue, committedTextValue, commitValueChange } =
    useCellController({
      document,
      docId,
      materializedFieldPath,
      value,
      isEditable: true,
      onDocumentDataChange,
    })

  const [focusedField, setFocusedField] = useState<string | null>(null)
  const [isInputFocused, setIsInputFocused] = useState(false)
  const [isSelectOpen, setIsSelectOpen] = useState(false)
  const cellRootRef = React.useRef<HTMLDivElement>(null)
  const [draftTextValue, setDraftTextValue] = useState<string>(
    () => committedTextValue
  )
  const activeTextValue = isInputFocused ? draftTextValue : committedTextValue

  const isNestedEditorOpen = openEditorPath === materializedFieldPath
  const isActivityLocked = isInputFocused || isSelectOpen || isNestedEditorOpen

  useElevatedVirtualRow({
    cellRootRef,
    isInputFocused,
    isSelectOpen,
  })

  React.useEffect(() => {
    onActivityLockChange(isActivityLocked)
  }, [isActivityLocked, onActivityLockChange])

  React.useEffect(
    () => () => {
      onActivityLockChange(false)
    },
    [onActivityLockChange]
  )

  const onCommit = useRefCallback((newValue: unknown) => {
    commitValueChange(formatValueForCommit(newValue, fieldMetadata.rawSchema))
  })

  return (
    <div
      ref={cellRootRef}
      className="h-full w-full focus-within:overflow-visible"
    >
      <CellEditor
        identity={{ docId, fieldPath: materializedFieldPath }}
        field={{
          schema,
          fieldMetadata,
          value,
          effectiveValue,
          isEditable: true,
        }}
        textDraft={{
          committedTextValue,
          activeTextValue,
          draftTextValue,
          setDraftTextValue,
        }}
        focus={{
          focusedField,
          setFocusedField,
          setIsInputFocused,
        }}
        overlays={{
          forceEditMode: true,
          showInput: true,
          isSelectOpen,
          setIsSelectOpen,
          openEditorPath,
          setOpenEditorPath,
        }}
        commit={{ onCommit }}
      />
    </div>
  )
}

function EditableJsonTableCellContent(props: JsonTableCellProps) {
  const materializedFieldPath = props.projectedCell?.materializedFieldPath
  const {
    schema,
    docId,
    setOpenEditorPath,
    openEditorPath,
    onDocumentDataChange,
    document,
    isCellActive = false,
    onCellActivityLockChange,
  } = props

  const value = props.projectedCell?.value
  const cellWidth = props.column.widthPx
  const fieldMetadata =
    props.column.fieldMetadata ??
    (materializedFieldPath
      ? getFieldMetadata(schema, materializedFieldPath)
      : undefined)
  const isEditable = props.isJsonEditable
  const isNestedEditorOpen =
    Boolean(materializedFieldPath) && openEditorPath === materializedFieldPath
  const isActive = isEditable && (isCellActive || isNestedEditorOpen)
  const handleActivityLockChange = useRefCallback((locked: boolean) => {
    if (materializedFieldPath) {
      onCellActivityLockChange?.(materializedFieldPath, locked)
    }
  })

  if (!materializedFieldPath || !fieldMetadata) {
    return (
      <TableCell
        data-field-path={materializedFieldPath}
        className="relative cursor-not-allowed bg-muted/60 p-0"
        style={getCellWidthStyle(cellWidth)}
      >
        <JsonTableScalarCell kind="text" value={null} placeholder="" />
      </TableCell>
    )
  }

  return (
    <TableCell
      data-field-path={materializedFieldPath}
      data-json-table-editable-cell="true"
      data-active={isActive || undefined}
      className={[
        "relative m-0 border-t-0 border-r border-b border-l-0 p-0 select-none",
        interactiveCellOverlayClass,
      ].join(" ")}
      style={getSelectableCellWidthStyle(cellWidth)}
    >
      {isActive ? (
        <ActiveEditableJsonTableCell
          docId={docId}
          document={document}
          fieldMetadata={fieldMetadata}
          materializedFieldPath={materializedFieldPath}
          openEditorPath={openEditorPath}
          schema={schema}
          setOpenEditorPath={setOpenEditorPath}
          value={value}
          onActivityLockChange={handleActivityLockChange}
          onDocumentDataChange={onDocumentDataChange}
        />
      ) : (
        <JsonTableDisplayCell fieldMetadata={fieldMetadata} value={value} />
      )}
    </TableCell>
  )
}

export const EditableJsonTableCell = React.memo(
  EditableJsonTableCellContent,
  (prev, next) =>
    cmp(editableCellMemoVariables(prev), editableCellMemoVariables(next), {
      deep: ["projectedCell.arrayIndexes"],
    })
)
EditableJsonTableCell.displayName = "EditableJsonTableCell"
