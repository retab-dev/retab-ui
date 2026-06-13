import * as React from "react"

import { DataCellDisplay } from "@/components/ui/data-cell"
import { TableCell } from "@/components/ui/table"
import { getDataCellDisplayTextSelectionOffset } from "@/registry/new-york-v4/ui/data-cell-text-hit-test"
import {
  getCellWidthStyle,
  getSelectableCellWidthStyle,
  interactiveCellOverlayClass,
} from "@/components/json-table/cell-style"
import type { JsonTableCellProps } from "@/components/json-table/json-table-cell-types"
import {
  dataCellKindForField,
  JsonTableDataCell,
  JsonTableDisplayCell,
} from "@/components/json-table/json-table-display-cell"
import { jsonTableCellId } from "@/components/json-table/json-table-edit-session"
import {
  markJsonTableProfile,
  recordJsonTableRender,
} from "@/components/json-table/json-table-profiler"
import { JsonTableStructuredCell } from "@/components/json-table/json-table-structured-cell"
import { getFieldMetadata } from "@/components/json-table/lib/schema-field-metadata"
import type { FieldMetadata } from "@/components/json-table/lib/schema-field-metadata"
import { formatValueForCommit } from "@/components/json-table/lib/value-normalization"
import { cmp, useRefCallback } from "@/components/json-table/path-utils"
import { useCellController } from "@/components/json-table/use-cell-controller"
import { useElevatedVirtualRow } from "@/components/json-table/use-elevated-virtual-row"
import type { DataCellActivationIntent } from "@/components/ui/data-cell"

function editableCellMemoVariables(props: JsonTableCellProps) {
  const { document: _document, editSession: _editSession, ...rest } = props
  const materializedFieldPath = props.projectedCell?.materializedFieldPath
  const isSessionCell =
    Boolean(materializedFieldPath) &&
    props.editSession?.fieldPath === materializedFieldPath
  const editSessionId = isSessionCell ? (props.editSession?.id ?? null) : null
  const editSessionOverlayOpen = isSessionCell
    ? (props.editSession?.isOverlayOpen ?? false)
    : false
  return {
    ...rest,
    editSessionId,
    editSessionOverlayOpen,
    materializedFieldPath,
  }
}

const jsonTableNumberKeyPattern = /^[0-9.+-]$/

function canActivatePrimitiveFromKey(
  fieldMetadata: FieldMetadata,
  key: string
) {
  if (key === "Enter" || key === "F2") return true
  if (fieldMetadata.kind === "boolean") return key === " "
  if (
    fieldMetadata.kind === "enum" ||
    fieldMetadata.kind === "date" ||
    fieldMetadata.kind === "time" ||
    fieldMetadata.kind === "date-time"
  ) {
    return key === " "
  }
  if (key.length !== 1) return false
  if (fieldMetadata.kind === "integer") return /^[+-]$|^\d$/.test(key)
  if (fieldMetadata.kind === "number") return jsonTableNumberKeyPattern.test(key)
  return fieldMetadata.kind === "string"
}

function JsonTableActiveCell({
  docId,
  document,
  fieldMetadata,
  materializedFieldPath,
  schema,
  session,
  value,
  closeEditSession,
  onDocumentDataChange,
  setEditSessionOverlayOpen,
}: {
  docId: string
  document: JsonTableCellProps["document"]
  fieldMetadata: FieldMetadata
  materializedFieldPath: string
  schema: JsonTableCellProps["schema"]
  session: NonNullable<JsonTableCellProps["editSession"]>
  value: unknown
  closeEditSession: JsonTableCellProps["closeEditSession"]
  onDocumentDataChange: JsonTableCellProps["onDocumentDataChange"]
  setEditSessionOverlayOpen: JsonTableCellProps["setEditSessionOverlayOpen"]
}) {
  recordJsonTableRender("JsonTableActiveCell", materializedFieldPath, {
    editSessionId: session.id,
    fieldKind: fieldMetadata.kind,
    isOverlayOpen: session.isOverlayOpen,
    valueType: value === null ? "null" : typeof value,
  })

  const { effectiveValue, commitValueChange } = useCellController({
    document,
    docId,
    materializedFieldPath,
    value,
    isEditable: true,
    onDocumentDataChange,
  })

  const cellRootRef = React.useRef<HTMLDivElement>(null)
  recordJsonTableRender("JsonTableActiveControl", materializedFieldPath, {
    editSessionId: session.id,
    fieldKind: fieldMetadata.kind,
    isEditable: true,
    isOverlayOpen: session.isOverlayOpen,
  })

  useElevatedVirtualRow({
    cellRootRef,
    isInputFocused: true,
    isSelectOpen: session.isOverlayOpen,
  })

  React.useEffect(() => {
    markJsonTableProfile("active-control-mounted", {
      fieldPath: materializedFieldPath,
      fieldKind: fieldMetadata.kind,
    })
  }, [fieldMetadata.kind, materializedFieldPath])

  const commitValue = useRefCallback((newValue: unknown) => {
    commitValueChange(formatValueForCommit(newValue, fieldMetadata.rawSchema))
  })

  return (
    <div
      ref={cellRootRef}
      className="h-full w-full focus-within:overflow-visible"
    >
      <JsonTableStructuredCell
        fieldPath={materializedFieldPath}
        fieldMetadata={fieldMetadata}
        schema={schema}
        effectiveValue={effectiveValue}
        isEditable={true}
        editSession={session}
        setOverlayOpen={setEditSessionOverlayOpen}
        closeEditSession={closeEditSession}
        commitValue={commitValue}
      />
    </div>
  )
}

function EditableJsonTableCellContent(props: JsonTableCellProps) {
  const materializedFieldPath = props.projectedCell?.materializedFieldPath
  const {
    schema,
    docId,
    editSession,
    startEditSession,
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
  const dataCellKind = fieldMetadata ? dataCellKindForField(fieldMetadata) : null
  const isPrimitiveCell = Boolean(dataCellKind)
  const isEditable = props.isJsonEditable
  const cellId = materializedFieldPath
    ? jsonTableCellId(docId, materializedFieldPath)
    : null
  const isEditing = Boolean(
    isEditable && cellId && editSession?.cellId === cellId
  )
  const tableCellRef = React.useRef<HTMLTableCellElement>(null)
  const wasEditingRef = React.useRef(isEditing)
  const didActivateBeforeClickRef = React.useRef(false)
  const [primitiveActivationIntent, setPrimitiveActivationIntent] =
    React.useState<DataCellActivationIntent>()
  const { effectiveValue, commitValueChange } = useCellController({
    document: props.document,
    docId,
    materializedFieldPath,
    value,
    isEditable: isEditable && isPrimitiveCell,
    onDocumentDataChange: props.onDocumentDataChange,
  })

  const commitPrimitiveValue = useRefCallback((newValue: unknown) => {
    if (!fieldMetadata) return
    commitValueChange(formatValueForCommit(newValue, fieldMetadata.rawSchema))
  })

  const setPrimitiveActive = React.useCallback(
    (nextActive: boolean) => {
      if (!props.projectedCell || !isPrimitiveCell) return
      if (nextActive) {
        startEditSession(props.projectedCell, { type: "programmatic" })
        return
      }
      if (isEditing) props.closeEditSession()
    },
    [
      isEditing,
      isPrimitiveCell,
      props.closeEditSession,
      props.projectedCell,
      startEditSession,
    ]
  )

  React.useLayoutEffect(() => {
    if (wasEditingRef.current && !isEditing && !editSession) {
      tableCellRef.current?.focus({ preventScroll: true })
    }
    wasEditingRef.current = isEditing
  }, [editSession, isEditing])

  recordJsonTableRender(
    "EditableJsonTableCell",
    materializedFieldPath ?? props.column.key,
    {
      editSessionFieldPath: editSession?.fieldPath ?? null,
      fieldKind: fieldMetadata?.kind ?? null,
      isEditable,
      isEditing,
      valueType: value === null ? "null" : typeof value,
    }
  )

  const handlePointerEnter = React.useCallback(
    (event: React.PointerEvent<HTMLTableCellElement>) => {
      if (!materializedFieldPath || !isEditable) return
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
      if (
        !props.projectedCell ||
        !materializedFieldPath ||
        !fieldMetadata ||
        !isEditable ||
        event.button !== 0
      ) {
        return
      }
      if (isPrimitiveCell) {
        if (isEditing) return
        const target = event.target
        if (
          target instanceof Element &&
          (target.closest('[data-slot="data-cell"]') ||
            target.closest('[data-slot="input-control"]'))
        ) {
          return
        }
        if (fieldMetadata.kind === "boolean") {
          commitPrimitiveValue(!Boolean(effectiveValue))
          didActivateBeforeClickRef.current = true
          return
        }
        const intent: DataCellActivationIntent = {
          type: "pointer",
          clientX: event.clientX,
          clientY: event.clientY,
          detail: event.detail,
        }
        if (fieldMetadata.kind === "string") {
          const textElement =
            tableCellRef.current?.querySelector<HTMLElement>(
              '[data-slot="data-cell-value"]'
            )
          if (textElement) {
            intent.selectionOffset = getDataCellDisplayTextSelectionOffset({
              clientX: event.clientX,
              clientY: event.clientY,
              textElement,
              value:
                effectiveValue === null || effectiveValue === undefined
                  ? ""
                  : String(effectiveValue),
            })
          }
        }
        setPrimitiveActivationIntent(intent)
        didActivateBeforeClickRef.current = true
        setPrimitiveActive(true)
        return
      }
      if (isEditing) return

      startEditSession(props.projectedCell, {
        type: "pointer",
        clientX: event.clientX,
        clientY: event.clientY,
        detail: event.detail,
      })
    },
    [
      fieldMetadata,
      isPrimitiveCell,
      commitPrimitiveValue,
      effectiveValue,
      isEditable,
      isEditing,
      materializedFieldPath,
      props.projectedCell,
      setPrimitiveActive,
      startEditSession,
    ]
  )
  const handleClick = React.useCallback(
    (event: React.MouseEvent<HTMLTableCellElement>) => {
      if (didActivateBeforeClickRef.current) {
        didActivateBeforeClickRef.current = false
        return
      }
      if (
        !props.projectedCell ||
        !materializedFieldPath ||
        !fieldMetadata ||
        !isEditable ||
        event.button !== 0 ||
        !isPrimitiveCell ||
        isEditing
      ) {
        return
      }
      const target = event.target
      if (
        target instanceof Element &&
        (target.closest('[data-slot="data-cell"]') ||
          target.closest('[data-slot="input-control"]'))
      ) {
        return
      }
      if (fieldMetadata.kind === "boolean") {
        commitPrimitiveValue(!Boolean(effectiveValue))
        return
      }
      setPrimitiveActivationIntent({ type: "programmatic" })
      setPrimitiveActive(true)
    },
    [
      commitPrimitiveValue,
      effectiveValue,
      fieldMetadata,
      isEditable,
      isEditing,
      isPrimitiveCell,
      materializedFieldPath,
      props.projectedCell,
      setPrimitiveActive,
    ]
  )
  const handleKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLTableCellElement>) => {
      if (
        !props.projectedCell ||
        !materializedFieldPath ||
        !fieldMetadata ||
        !isEditable
      ) {
        return
      }
      if (isPrimitiveCell) {
        if (isEditing) return
        const isAltGraph =
          event.getModifierState("AltGraph") ||
          event.nativeEvent.getModifierState?.("AltGraph") ||
          (event.ctrlKey &&
            event.altKey &&
            event.key.length === 1 &&
            !/^[\x00-\x7F]$/.test(event.key))
        if (
          event.defaultPrevented ||
          event.metaKey ||
          (event.ctrlKey && !isAltGraph) ||
          (event.altKey && !isAltGraph) ||
          event.nativeEvent.isComposing ||
          !canActivatePrimitiveFromKey(fieldMetadata, event.key)
        ) {
          return
        }

        event.preventDefault()
        if (fieldMetadata.kind === "boolean" && event.key === " ") {
          commitPrimitiveValue(!Boolean(effectiveValue))
          didActivateBeforeClickRef.current = true
          return
        }
        setPrimitiveActivationIntent({
          type: "keyboard",
          key: event.key,
        })
        setPrimitiveActive(true)
        return
      }
      if (isEditing) return
      const isAltGraph =
        event.getModifierState("AltGraph") ||
        event.nativeEvent.getModifierState?.("AltGraph") ||
        (event.ctrlKey &&
          event.altKey &&
          event.key.length === 1 &&
          !/^[\x00-\x7F]$/.test(event.key))
      if (
        event.defaultPrevented ||
        event.metaKey ||
        (event.ctrlKey && !isAltGraph) ||
        (event.altKey && !isAltGraph) ||
        event.nativeEvent.isComposing
      ) {
        return
      }
      if (event.key !== "Enter" && event.key !== "F2" && event.key !== " ") {
        return
      }

      event.preventDefault()
      startEditSession(props.projectedCell, {
        type: "keyboard",
        key: event.key,
      })
    },
    [
      isEditable,
      isEditing,
      isPrimitiveCell,
      commitPrimitiveValue,
      effectiveValue,
      fieldMetadata,
      materializedFieldPath,
      props.projectedCell,
      setPrimitiveActive,
      startEditSession,
    ]
  )
  const handlePointerLeave = React.useCallback(() => {
    onCellHoverEnd?.()
  }, [onCellHoverEnd])

  if (!materializedFieldPath || !fieldMetadata) {
    return (
      <TableCell
        data-field-path={materializedFieldPath}
        className="relative cursor-not-allowed bg-muted/60 p-0"
        style={getCellWidthStyle(cellWidth)}
      >
        <DataCellDisplay kind="text" value={null} placeholder="" />
      </TableCell>
    )
  }

  return (
    <TableCell
      ref={tableCellRef}
      data-field-path={materializedFieldPath}
      data-json-table-editable-cell="true"
      data-active={isEditing || undefined}
      onPointerEnter={handlePointerEnter}
      onPointerMove={handlePointerEnter}
      onPointerDown={handlePointerDown}
      onClick={handleClick}
      onPointerLeave={handlePointerLeave}
      onKeyDown={handleKeyDown}
      tabIndex={isEditable ? 0 : undefined}
      className={[
        "relative m-0 border-t-0 border-r border-b border-l-0 p-0 select-none",
        interactiveCellOverlayClass,
      ].join(" ")}
      style={getSelectableCellWidthStyle(cellWidth)}
    >
      {isPrimitiveCell ? (
        <JsonTableDataCell
          fieldMetadata={fieldMetadata}
          value={effectiveValue}
          mode={isEditing ? "edit" : "display"}
          active={isEditing}
          isEditable={isEditable}
          activationIntent={primitiveActivationIntent}
          autoFocus={isEditing}
          onActiveChange={setPrimitiveActive}
          onCommit={commitPrimitiveValue}
          onEditingEnd={props.closeEditSession}
        />
      ) : isEditing && editSession ? (
        <JsonTableActiveCell
          docId={docId}
          document={props.document}
          fieldMetadata={fieldMetadata}
          materializedFieldPath={materializedFieldPath}
          schema={schema}
          session={editSession}
          value={value}
          closeEditSession={props.closeEditSession}
          onDocumentDataChange={props.onDocumentDataChange}
          setEditSessionOverlayOpen={props.setEditSessionOverlayOpen}
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
