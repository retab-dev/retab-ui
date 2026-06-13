import * as React from "react"
import { useState } from "react"
import { flushSync } from "react-dom"

import { TableCell } from "@/components/ui/table"
import { CellEditor } from "@/components/json-table/cell-editors/cell-editor"
import {
  getCellWidthStyle,
  getSelectableCellWidthStyle,
  interactiveCellOverlayClass,
} from "@/components/json-table/cell-style"
import type { JsonTableCellProps } from "@/components/json-table/json-table-cell-types"
import { JsonTableDisplayCell } from "@/components/json-table/json-table-display-cell"
import {
  markJsonTableProfile,
  recordJsonTableRender,
} from "@/components/json-table/json-table-profiler"
import { JsonTableScalarCell } from "@/components/json-table/json-table-scalar-cell"
import { getFieldMetadata } from "@/components/json-table/lib/schema-field-metadata"
import type { FieldMetadata } from "@/components/json-table/lib/schema-field-metadata"
import { formatValueForCommit } from "@/components/json-table/lib/value-normalization"
import { cmp, useRefCallback } from "@/components/json-table/path-utils"
import { useCellController } from "@/components/json-table/use-cell-controller"
import { useElevatedVirtualRow } from "@/components/json-table/use-elevated-virtual-row"

function editableCellMemoVariables(props: JsonTableCellProps) {
  const { document: _document, ...rest } = props
  const materializedFieldPath = props.projectedCell?.materializedFieldPath
  return { ...rest, materializedFieldPath }
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
  shouldAutoFocus,
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
  shouldAutoFocus: boolean
}) {
  recordJsonTableRender("ActiveEditableJsonTableCell", materializedFieldPath, {
    fieldKind: fieldMetadata.kind,
    openEditorPath,
    valueType: value === null ? "null" : typeof value,
  })

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

  React.useLayoutEffect(() => {
    if (!shouldAutoFocus) return

    const root = cellRootRef.current
    if (!root || root.contains(globalThis.document.activeElement)) return

    const focusTarget = root.querySelector<HTMLElement>(
      'input:not(:disabled), textarea:not(:disabled), [role="combobox"], button:not(:disabled)'
    )
    focusTarget?.focus({ preventScroll: true })

    if (
      focusTarget instanceof HTMLInputElement &&
      (focusTarget.type === "text" ||
        focusTarget.type === "search" ||
        focusTarget.type === "url" ||
        focusTarget.type === "tel" ||
        focusTarget.type === "email" ||
        focusTarget.type === "password")
    ) {
      const textLength = focusTarget.value.length
      focusTarget.setSelectionRange(textLength, textLength)
    }
  }, [shouldAutoFocus])

  React.useEffect(() => {
    markJsonTableProfile("active-editor-mounted", {
      fieldPath: materializedFieldPath,
      fieldKind: fieldMetadata.kind,
    })
  }, [fieldMetadata.kind, materializedFieldPath])

  React.useEffect(() => {
    markJsonTableProfile("cell-activity-lock-change", {
      fieldPath: materializedFieldPath,
      locked: isActivityLocked,
    })
    onActivityLockChange(isActivityLocked)
  }, [isActivityLocked, materializedFieldPath, onActivityLockChange])

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
          autoFocus: shouldAutoFocus,
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
    onCellHoverStart,
    onCellHoverEnd,
  } = props

  const value = props.projectedCell?.value
  const cellWidth = props.column.widthPx
  const fieldMetadata =
    props.column.fieldMetadata ??
    (materializedFieldPath
      ? getFieldMetadata(schema, materializedFieldPath)
      : undefined)
  const isEditable = props.isJsonEditable
  const [isPointerActive, setIsPointerActive] = React.useState(false)
  const [isActivityLocked, setIsActivityLocked] = React.useState(false)
  const [shouldAutoFocus, setShouldAutoFocus] = React.useState(false)
  const pointerOverRef = React.useRef(false)
  const isNestedEditorOpen =
    Boolean(materializedFieldPath) && openEditorPath === materializedFieldPath
  const isActive =
    isEditable && (isPointerActive || isActivityLocked || isNestedEditorOpen)
  recordJsonTableRender(
    "EditableJsonTableCell",
    materializedFieldPath ?? props.column.key,
    {
      fieldKind: fieldMetadata?.kind ?? null,
      isActive,
      isActivityLocked,
      isEditable,
      isNestedEditorOpen,
      isPointerActive,
      shouldAutoFocus,
      openEditorPath,
      valueType: value === null ? "null" : typeof value,
    }
  )
  const handleActivityLockChange = useRefCallback((locked: boolean) => {
    setIsActivityLocked(locked)
    if (!locked) {
      setShouldAutoFocus(false)
    }
    if (!locked && !pointerOverRef.current) {
      setIsPointerActive(false)
    }
  })
  const handlePointerEnter = React.useCallback(
    (event: React.PointerEvent<HTMLTableCellElement>) => {
      if (!materializedFieldPath || !isEditable) return
      if (pointerOverRef.current) return
      pointerOverRef.current = true
      markJsonTableProfile("pointer-enter-cell", {
        fieldPath: materializedFieldPath,
      })
      onCellHoverStart?.({
        docId,
        fieldPath: materializedFieldPath,
        rect: event.currentTarget.getBoundingClientRect(),
      })
    },
    [docId, isEditable, materializedFieldPath, onCellHoverStart]
  )
  const handlePointerDown = React.useCallback(
    (event: React.PointerEvent<HTMLTableCellElement>) => {
      if (!materializedFieldPath || !isEditable || event.button !== 0) return

      const target = event.target instanceof Element ? event.target : null
      const dataCell = target?.closest('[data-slot="data-cell"]')
      const isEditingCell =
        dataCell instanceof HTMLElement && dataCell.dataset.mode === "edit"

      if (fieldMetadata?.kind === "boolean" && !isEditingCell) {
        onDocumentDataChange(docId, materializedFieldPath, !Boolean(value))
        event.preventDefault()
        event.stopPropagation()
        return
      }

      pointerOverRef.current = true
      flushSync(() => {
        setIsPointerActive(true)
        setShouldAutoFocus(true)
      })
    },
    [
      docId,
      fieldMetadata?.kind,
      isEditable,
      materializedFieldPath,
      onDocumentDataChange,
      value,
    ]
  )
  const handlePointerLeave = React.useCallback(() => {
    pointerOverRef.current = false
    onCellHoverEnd?.()
    setShouldAutoFocus(false)
    if (!isActivityLocked) {
      setIsPointerActive(false)
    }
  }, [isActivityLocked, onCellHoverEnd])

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
      onPointerEnter={handlePointerEnter}
      onPointerMove={handlePointerEnter}
      onPointerDown={handlePointerDown}
      onPointerLeave={handlePointerLeave}
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
          shouldAutoFocus={shouldAutoFocus}
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
