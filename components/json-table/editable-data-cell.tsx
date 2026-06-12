import * as React from "react"
import { useState } from "react"

import { cn } from "@/lib/utils"
import { CellEditor } from "@/components/json-table/cell-editors/cell-editor"
import {
  getCellWidthStyle,
  getSelectableCellWidthStyle,
} from "@/components/json-table/cell-style"
import type { DataCellProps } from "@/components/json-table/data-cell-types"
import { getFieldMetadata } from "@/components/json-table/lib/schema-field-metadata"
import { formatValueForCommit } from "@/components/json-table/lib/value-normalization"
import { useRefCallback } from "@/components/json-table/path-utils"
import { useCellController } from "@/components/json-table/use-cell-controller"
import { useElevatedVirtualRow } from "@/components/json-table/use-elevated-virtual-row"
import { TableCell } from "@/components/ui-retab/table"

export function EditableDataCell(props: DataCellProps) {
  const materializedFieldPath = props.projectedCell?.materializedFieldPath
  const {
    schema,
    docId,
    setOpenEditorPath,
    openEditorPath,
    onDocumentDataChange,
    document,
  } = props

  const [focusedField, setFocusedField] = useState<string | null>(null)
  const [isInputFocused, setIsInputFocused] = useState(false)
  const [isSelectOpen, setIsSelectOpen] = useState(false)
  const [isDatePopoverOpen, setIsDatePopoverOpen] = useState(false)
  const [isPointerOver, setIsPointerOver] = useState(false)
  const [isTextEditing, setIsTextEditing] = useState(false)
  const cellRootRef = React.useRef<HTMLDivElement>(null)

  useElevatedVirtualRow({
    cellRootRef,
    isInputFocused,
    isSelectOpen,
    isDatePopoverOpen,
  })

  const value = props.projectedCell?.value
  const { effectiveValue, committedTextValue, commitValueChange } =
    useCellController({
      document,
      docId,
      materializedFieldPath,
      value,
      isEditable: props.allowEditing,
      onDocumentDataChange,
    })
  const [draftTextValue, setDraftTextValue] = useState<string>(
    () => committedTextValue
  )
  const activeTextValue =
    isInputFocused || isDatePopoverOpen ? draftTextValue : committedTextValue

  const cellWidth = props.column.widthPx

  const fieldMetadata =
    props.column.fieldMetadata ??
    (materializedFieldPath
      ? getFieldMetadata(schema, materializedFieldPath)
      : undefined)
  const isEditable = props.allowEditing ?? false
  const showInput =
    (isPointerOver || isInputFocused || isSelectOpen || isDatePopoverOpen) &&
    isEditable

  const onCommit = useRefCallback((newValue: unknown) => {
    if (!materializedFieldPath || !fieldMetadata) return
    commitValueChange(formatValueForCommit(newValue, fieldMetadata.rawSchema))
  })

  const handleCellHover = useRefCallback((event: React.MouseEvent) => {
    if (!materializedFieldPath) return
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
    props.onCellHoverStart?.({ docId, fieldPath: materializedFieldPath, rect })
  })

  if (!materializedFieldPath || !fieldMetadata) {
    return (
      <TableCell
        data-field-path={materializedFieldPath}
        className="relative cursor-not-allowed bg-muted/60"
        style={getCellWidthStyle(cellWidth)}
      />
    )
  }

  return (
    <TableCell
      data-field-path={materializedFieldPath}
      className="relative m-0 border-t-0 border-r border-b border-l-0 p-0 select-none"
      onMouseLeave={() => {
        setIsPointerOver(false)
        if (isSelectOpen || isDatePopoverOpen || isInputFocused) return
        props.onCellHoverEnd?.()
      }}
      onMouseEnter={(event) => {
        setIsPointerOver(true)
        handleCellHover(event)
      }}
      style={getSelectableCellWidthStyle(cellWidth)}
    >
      <div
        ref={cellRootRef}
        className={cn(
          "h-full w-full focus-within:overflow-visible",
          isPointerOver && "border border-primary"
        )}
      >
        <CellEditor
          identity={{ docId, fieldPath: materializedFieldPath }}
          field={{
            schema,
            fieldMetadata,
            value,
            effectiveValue,
            isEditable,
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
            showInput,
            isSelectOpen,
            setIsSelectOpen,
            isDatePopoverOpen,
            setIsDatePopoverOpen,
            isTextEditing,
            setIsTextEditing,
            openEditorPath,
            setOpenEditorPath,
          }}
          commit={{ onCommit }}
        />
      </div>
    </TableCell>
  )
}
