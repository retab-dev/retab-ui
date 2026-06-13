import * as React from "react"
import { flushSync } from "react-dom"

import { DataCellDisplay } from "@/components/ui/data-cell"
import { TableCell } from "@/components/ui/table"
import { CellEditor } from "@/components/json-table/cell-editors/cell-editor"
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
import { getFieldMetadata } from "@/components/json-table/lib/schema-field-metadata"
import type { FieldMetadata } from "@/components/json-table/lib/schema-field-metadata"
import { formatValueForCommit } from "@/components/json-table/lib/value-normalization"
import { cmp, useRefCallback } from "@/components/json-table/path-utils"
import { useCellController } from "@/components/json-table/use-cell-controller"
import { useElevatedVirtualRow } from "@/components/json-table/use-elevated-virtual-row"

const JSON_TABLE_NUMBER_KEY = /^[0-9.+-]$/

function editableCellMemoVariables(props: JsonTableCellProps) {
  const { document: _document, editSession: _editSession, ...rest } = props
  const materializedFieldPath = props.projectedCell?.materializedFieldPath
  const isSessionCell =
    Boolean(materializedFieldPath) &&
    props.editSession?.fieldPath === materializedFieldPath
  const editSessionId = isSessionCell ? (props.editSession?.id ?? null) : null
  const editSessionDraftValue = isSessionCell
    ? props.editSession?.draftValue
    : undefined
  const editSessionOverlayOpen = isSessionCell
    ? (props.editSession?.isOverlayOpen ?? false)
    : false
  return {
    ...rest,
    editSessionDraftValue,
    editSessionId,
    editSessionOverlayOpen,
    materializedFieldPath,
  }
}

function isOverlayField(fieldMetadata: FieldMetadata): boolean {
  return (
    fieldMetadata.kind === "enum" ||
    fieldMetadata.kind === "date" ||
    fieldMetadata.kind === "time" ||
    fieldMetadata.kind === "date-time"
  )
}

function canStartEditFromKey(
  fieldMetadata: FieldMetadata,
  key: string
): boolean {
  if (key === "Enter" || key === "F2") return true

  if (fieldMetadata.kind === "boolean") return key === " "

  if (
    fieldMetadata.kind === "enum" ||
    fieldMetadata.kind === "date" ||
    fieldMetadata.kind === "time" ||
    fieldMetadata.kind === "date-time" ||
    fieldMetadata.kind === "object" ||
    fieldMetadata.kind === "array"
  ) {
    return key === " "
  }

  if (key.length !== 1) return false
  if (fieldMetadata.kind === "integer") return /^[+-]$|^\d$/.test(key)
  if (fieldMetadata.kind === "number") return /^[+\-.]$|^\d$/.test(key)
  return fieldMetadata.kind === "string"
}

function ActiveEditableJsonTableCell({
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
  updateEditSessionDraft,
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
  updateEditSessionDraft: JsonTableCellProps["updateEditSessionDraft"]
}) {
  recordJsonTableRender("ActiveEditableJsonTableCell", materializedFieldPath, {
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
  const draftTextValue =
    session.draftValue === null || session.draftValue === undefined
      ? ""
      : String(session.draftValue)
  const dataCellKind = dataCellKindForField(fieldMetadata)
  const usesDataCellEditor =
    Boolean(dataCellKind) && fieldMetadata.kind !== "enum"
  if (usesDataCellEditor) {
    recordJsonTableRender("CellEditor", materializedFieldPath, {
      editSessionId: session.id,
      fieldKind: fieldMetadata.kind,
      isEditable: true,
      isSelectOpen: session.isOverlayOpen,
    })
  }

  useElevatedVirtualRow({
    cellRootRef,
    isInputFocused: true,
    isSelectOpen: session.isOverlayOpen,
  })

  React.useEffect(() => {
    markJsonTableProfile("active-editor-mounted", {
      fieldPath: materializedFieldPath,
      fieldKind: fieldMetadata.kind,
    })
  }, [fieldMetadata.kind, materializedFieldPath])

  const commitValue = useRefCallback((newValue: unknown) => {
    commitValueChange(formatValueForCommit(newValue, fieldMetadata.rawSchema))
  })

  const setDraftTextValue = React.useCallback(
    (draftValue: string) => {
      updateEditSessionDraft(draftValue)
    },
    [updateEditSessionDraft]
  )

  React.useEffect(() => {
    if (session.intent.type !== "keyboard" || session.intent.key.length !== 1) {
      return
    }
    if (fieldMetadata.kind === "string") {
      setDraftTextValue(session.intent.key)
      return
    }
    if (
      (fieldMetadata.kind === "number" || fieldMetadata.kind === "integer") &&
      JSON_TABLE_NUMBER_KEY.test(session.intent.key)
    ) {
      setDraftTextValue(session.intent.key)
    }
  }, [
    fieldMetadata.kind,
    session.id,
    session.intent,
    setDraftTextValue,
  ])

  React.useEffect(() => {
    if (fieldMetadata.kind !== "boolean") return
    const shouldToggle =
      session.intent.type === "pointer" ||
      session.intent.type === "programmatic" ||
      (session.intent.type === "keyboard" &&
        session.intent.key === " ")
    if (!shouldToggle) return

    commitValue(!Boolean(effectiveValue))
    closeEditSession()
  }, [
    closeEditSession,
    commitValue,
    effectiveValue,
    fieldMetadata.kind,
    session.id,
    session.intent,
  ])

  const handleDataCellKeyDown = React.useCallback<
    React.KeyboardEventHandler<HTMLElement>
  >(
    (event) => {
      if (fieldMetadata.kind !== "boolean" || event.key !== "Escape") return
      event.preventDefault()
      closeEditSession()
    },
    [closeEditSession, fieldMetadata.kind]
  )

  return (
    <div
      ref={cellRootRef}
      className="h-full w-full focus-within:overflow-visible"
    >
      {usesDataCellEditor ? (
        <JsonTableDataCell
          fieldMetadata={fieldMetadata}
          value={effectiveValue}
          mode="edit"
          isEditable={true}
          draftValue={draftTextValue}
          activationIntent={session.intent}
          autoFocus
          isPickerOpen={session.isOverlayOpen}
          onDraftValueChange={setDraftTextValue}
          onCommit={commitValue}
          onEditingEnd={closeEditSession}
          onKeyDown={handleDataCellKeyDown}
          onPickerOpenChange={setEditSessionOverlayOpen}
        />
      ) : (
        <CellEditor
          cell={{
            docId,
            fieldPath: materializedFieldPath,
            schema,
            fieldMetadata,
            value,
            effectiveValue,
            isEditable: true,
          }}
          editSession={session}
          draftValue={draftTextValue}
          setDraftValue={setDraftTextValue}
          setOverlayOpen={setEditSessionOverlayOpen}
          closeEditSession={closeEditSession}
          commitValue={commitValue}
        />
      )}
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
  const isEditable = props.isJsonEditable
  const cellId = materializedFieldPath
    ? jsonTableCellId(docId, materializedFieldPath)
    : null
  const isEditing = Boolean(
    isEditable && cellId && editSession?.cellId === cellId
  )
  const tableCellRef = React.useRef<HTMLTableCellElement>(null)
  const wasEditingRef = React.useRef(isEditing)

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
      if (isEditing) {
        if (fieldMetadata.kind === "enum") {
          props.setEditSessionOverlayOpen(true)
        }
        return
      }

      flushSync(() => {
        startEditSession(props.projectedCell!, {
          type: "pointer",
          clientX: event.clientX,
          clientY: event.clientY,
          detail: event.detail,
        })
      })
    },
    [
      editSession?.isOverlayOpen,
      fieldMetadata,
      isEditable,
      isEditing,
      materializedFieldPath,
      props.projectedCell,
      props.setEditSessionOverlayOpen,
      startEditSession,
    ]
  )
  const handleOverlayActivationTail = React.useCallback(
    (event: React.SyntheticEvent<HTMLTableCellElement>) => {
      if (!fieldMetadata) return
      if (!isEditing || !isOverlayField(fieldMetadata)) return
      event.stopPropagation()
    },
    [fieldMetadata, isEditing]
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
      if (!canStartEditFromKey(fieldMetadata, event.key)) return

      event.preventDefault()
      startEditSession(props.projectedCell, {
        type: "keyboard",
        key: event.key,
      })
    },
    [
      isEditable,
      isEditing,
      fieldMetadata,
      materializedFieldPath,
      props.projectedCell,
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
      onMouseDownCapture={handleOverlayActivationTail}
      onPointerLeave={handlePointerLeave}
      onKeyDown={handleKeyDown}
      tabIndex={isEditable ? 0 : undefined}
      className={[
        "relative m-0 border-t-0 border-r border-b border-l-0 p-0 select-none",
        interactiveCellOverlayClass,
      ].join(" ")}
      style={getSelectableCellWidthStyle(cellWidth)}
    >
      {isEditing && editSession ? (
        <ActiveEditableJsonTableCell
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
          updateEditSessionDraft={props.updateEditSessionDraft}
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
