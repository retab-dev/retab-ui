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
import { JsonTableDisplayCell } from "@/components/json-table/json-table-display-cell"
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

  return (
    <div
      ref={cellRootRef}
      className="h-full w-full focus-within:overflow-visible"
    >
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
        !isEditable ||
        event.button !== 0
      ) {
        return
      }
      if (isEditing) return

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
      isEditable,
      isEditing,
      materializedFieldPath,
      props.projectedCell,
      startEditSession,
    ]
  )
  const handleKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLTableCellElement>) => {
      if (!props.projectedCell || !materializedFieldPath || !isEditable) return
      if (isEditing) return
      if (
        event.key !== "Enter" &&
        event.key !== "F2" &&
        event.key !== " " &&
        event.key.length !== 1
      ) {
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
      data-field-path={materializedFieldPath}
      data-json-table-editable-cell="true"
      data-active={isEditing || undefined}
      onPointerEnter={handlePointerEnter}
      onPointerMove={handlePointerEnter}
      onPointerDown={handlePointerDown}
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
