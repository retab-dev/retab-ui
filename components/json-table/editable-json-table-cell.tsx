import * as React from "react"
import { flushSync } from "react-dom"

import {
  canActivateDataCellFromKey,
  DataCellDisplay,
} from "@/components/ui/data-cell"
import type {
  DataCellActivationIntent,
  DataCellEditorHandle,
} from "@/components/ui/data-cell"
import { TableCell } from "@/components/ui/table"
import {
  getCellWidthStyle,
  getSelectableCellWidthStyle,
  interactiveCellOverlayClass,
} from "@/components/json-table/cell-style"
import type { JsonTableCellProps } from "@/components/json-table/json-table-cell-types"
import {
  dataCellKindForField,
  JsonTableDisplayCell,
} from "@/components/json-table/json-table-display-cell"
import { jsonTableCellId } from "@/components/json-table/json-table-edit-session"
import { JsonTablePrimitiveCell } from "@/components/json-table/json-table-primitive-cell"
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

function editableCellMemoVariables(props: JsonTableCellProps) {
  const {
    document: _document,
    primitiveActiveCell: _primitiveActiveCell,
    structuredEditSession: _structuredEditSession,
    ...rest
  } = props
  const materializedFieldPath = props.projectedCell?.materializedFieldPath
  const isPrimitiveActiveCell =
    Boolean(materializedFieldPath) &&
    props.primitiveActiveCell?.fieldPath === materializedFieldPath
  const isStructuredSessionCell =
    Boolean(materializedFieldPath) &&
    props.structuredEditSession?.fieldPath === materializedFieldPath
  const structuredEditSessionId = isStructuredSessionCell
    ? (props.structuredEditSession?.id ?? null)
    : null
  const structuredEditSessionOverlayOpen = isStructuredSessionCell
    ? (props.structuredEditSession?.isOverlayOpen ?? false)
    : false
  return {
    ...rest,
    primitiveActiveCellId: props.primitiveActiveCell?.cellId ?? null,
    isPrimitiveActiveCell,
    structuredEditSessionId,
    structuredEditSessionOverlayOpen,
    materializedFieldPath,
  }
}

function JsonTableStructuredActiveCell({
  docId,
  document,
  fieldMetadata,
  materializedFieldPath,
  schema,
  structuredEditSession,
  value,
  closeStructuredEditSession,
  onDocumentDataChange,
  setStructuredEditSessionOverlayOpen,
}: {
  docId: string
  document: JsonTableCellProps["document"]
  fieldMetadata: FieldMetadata
  materializedFieldPath: string
  schema: JsonTableCellProps["schema"]
  structuredEditSession: NonNullable<
    JsonTableCellProps["structuredEditSession"]
  >
  value: unknown
  closeStructuredEditSession: JsonTableCellProps["closeStructuredEditSession"]
  onDocumentDataChange: JsonTableCellProps["onDocumentDataChange"]
  setStructuredEditSessionOverlayOpen: JsonTableCellProps["setStructuredEditSessionOverlayOpen"]
}) {
  recordJsonTableRender(
    "JsonTableStructuredActiveCell",
    materializedFieldPath,
    {
      structuredEditSessionId: structuredEditSession.id,
      fieldKind: fieldMetadata.kind,
      isOverlayOpen: structuredEditSession.isOverlayOpen,
      valueType: value === null ? "null" : typeof value,
    }
  )

  const { effectiveValue, commitValueChange } = useCellController({
    document,
    docId,
    materializedFieldPath,
    value,
    isEditable: true,
    onDocumentDataChange,
  })

  const cellRootRef = React.useRef<HTMLDivElement>(null)
  recordJsonTableRender(
    "JsonTableStructuredActiveControl",
    materializedFieldPath,
    {
      structuredEditSessionId: structuredEditSession.id,
      fieldKind: fieldMetadata.kind,
      isEditable: true,
      isOverlayOpen: structuredEditSession.isOverlayOpen,
    }
  )

  useElevatedVirtualRow({
    cellRootRef,
    isInputFocused: true,
    isSelectOpen: structuredEditSession.isOverlayOpen,
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
        structuredEditSession={structuredEditSession}
        setStructuredEditSessionOverlayOpen={
          setStructuredEditSessionOverlayOpen
        }
        closeStructuredEditSession={closeStructuredEditSession}
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
    primitiveActiveCell,
    setPrimitiveActiveCell,
    structuredEditSession,
    startStructuredEditSession,
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
  const dataCellKind = fieldMetadata
    ? dataCellKindForField(fieldMetadata)
    : null
  const isPrimitiveCell = Boolean(dataCellKind)
  const isEditable = props.isJsonEditable
  const cellId = materializedFieldPath
    ? jsonTableCellId(docId, materializedFieldPath)
    : null
  const isPrimitiveActive = Boolean(
    isEditable && cellId && primitiveActiveCell?.cellId === cellId
  )
  const isStructuredEditing = Boolean(
    isEditable && cellId && structuredEditSession?.cellId === cellId
  )
  const isEditing = isPrimitiveCell ? isPrimitiveActive : isStructuredEditing
  const tableCellRef = React.useRef<HTMLTableCellElement>(null)
  const wasEditingRef = React.useRef(isEditing)
  const didActivateBeforeClickRef = React.useRef(false)
  const [primitiveActivationRequest, setPrimitiveActivationRequest] =
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
      if (!cellId || !materializedFieldPath || !isPrimitiveCell) return
      if (nextActive) {
        setPrimitiveActiveCell({
          cellId,
          docId,
          fieldPath: materializedFieldPath,
        })
        return
      }
      if (isPrimitiveActive) setPrimitiveActiveCell(null)
    },
    [
      cellId,
      docId,
      isPrimitiveActive,
      isPrimitiveCell,
      materializedFieldPath,
      setPrimitiveActiveCell,
    ]
  )

  React.useEffect(() => {
    if (!isPrimitiveActive) setPrimitiveActivationRequest(undefined)
  }, [isPrimitiveActive])

  const finishPreviousPrimitiveCell = React.useCallback(() => {
    if (!primitiveActiveCell || primitiveActiveCell.cellId === cellId) return
    flushSync(() => {
      props.primitiveEditorHandleRef.current?.finish()
      props.primitiveEditorHandleRef.current = null
      setPrimitiveActiveCell(null)
    })
  }, [
    cellId,
    primitiveActiveCell,
    props.primitiveEditorHandleRef,
    setPrimitiveActiveCell,
  ])

  const setPrimitiveEditorHandle = React.useCallback(
    (handle: DataCellEditorHandle | null) => {
      if (!isPrimitiveActive) return
      props.primitiveEditorHandleRef.current = handle
    },
    [isPrimitiveActive, props.primitiveEditorHandleRef]
  )

  React.useLayoutEffect(() => {
    if (
      wasEditingRef.current &&
      !isEditing &&
      !primitiveActiveCell &&
      !structuredEditSession
    ) {
      tableCellRef.current?.focus({ preventScroll: true })
    }
    wasEditingRef.current = isEditing
  }, [isEditing, primitiveActiveCell, structuredEditSession])

  recordJsonTableRender(
    "EditableJsonTableCell",
    materializedFieldPath ?? props.column.key,
    {
      primitiveActiveFieldPath: primitiveActiveCell?.fieldPath ?? null,
      structuredEditSessionFieldPath: structuredEditSession?.fieldPath ?? null,
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
      finishPreviousPrimitiveCell()
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
        setPrimitiveActivationRequest({
          type: "pointer",
          clientX: event.clientX,
          clientY: event.clientY,
          detail: event.detail,
        })
        didActivateBeforeClickRef.current = true
        setPrimitiveActive(true)
        return
      }
      if (isStructuredEditing) return

      startStructuredEditSession(props.projectedCell, {
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
      finishPreviousPrimitiveCell,
      isEditable,
      isEditing,
      materializedFieldPath,
      props.projectedCell,
      setPrimitiveActive,
      startStructuredEditSession,
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
      finishPreviousPrimitiveCell()
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
      setPrimitiveActivationRequest({
        type: "pointer",
        clientX: event.clientX,
        clientY: event.clientY,
        detail: event.detail,
      })
      setPrimitiveActive(true)
    },
    [
      commitPrimitiveValue,
      effectiveValue,
      fieldMetadata,
      finishPreviousPrimitiveCell,
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
      finishPreviousPrimitiveCell()
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
          !dataCellKind ||
          !canActivateDataCellFromKey(dataCellKind, event.key)
        ) {
          return
        }

        event.preventDefault()
        if (fieldMetadata.kind === "boolean" && event.key === " ") {
          commitPrimitiveValue(!Boolean(effectiveValue))
          didActivateBeforeClickRef.current = true
          return
        }
        setPrimitiveActivationRequest({
          type: "keyboard",
          key: event.key,
        })
        setPrimitiveActive(true)
        return
      }
      if (isStructuredEditing) return
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
      startStructuredEditSession(props.projectedCell, {
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
      finishPreviousPrimitiveCell,
      materializedFieldPath,
      dataCellKind,
      props.projectedCell,
      setPrimitiveActive,
      startStructuredEditSession,
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
        <JsonTablePrimitiveCell
          fieldMetadata={fieldMetadata}
          effectiveValue={effectiveValue}
          isActive={isPrimitiveActive}
          isEditable={isEditable}
          activationRequest={primitiveActivationRequest}
          onActiveChange={setPrimitiveActive}
          onEditorHandleChange={setPrimitiveEditorHandle}
          onCommit={commitPrimitiveValue}
          onEditingEnd={() => setPrimitiveActive(false)}
        />
      ) : isStructuredEditing && structuredEditSession ? (
        <JsonTableStructuredActiveCell
          docId={docId}
          document={props.document}
          fieldMetadata={fieldMetadata}
          materializedFieldPath={materializedFieldPath}
          schema={schema}
          structuredEditSession={structuredEditSession}
          value={value}
          closeStructuredEditSession={props.closeStructuredEditSession}
          onDocumentDataChange={props.onDocumentDataChange}
          setStructuredEditSessionOverlayOpen={
            props.setStructuredEditSessionOverlayOpen
          }
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
