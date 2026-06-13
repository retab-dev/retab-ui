import * as React from "react"

import type { JsonTableShellHandlers } from "@/components/json-table/json-table-cell-shell"
import type { JsonTableCellProps } from "@/components/json-table/json-table-cell-types"
import {
  armShellActivationGuard,
  canActivatePrimitiveFromShellKey,
  canActivateStructuredFromShellKey,
  consumeShellActivationGuard,
  isJsonTableDataCellEventTarget,
  keyboardActivationRequest,
  shellActivationRequest,
  structuredKeyboardActivationIntent,
  structuredPointerActivationIntent,
} from "@/components/json-table/json-table-primitive-activation"
import { commitPrimitiveCommand } from "@/components/json-table/json-table-primitive-command"
import { finishPreviousPrimitiveEditor } from "@/components/json-table/json-table-primitive-handoff"
import { markJsonTableProfile } from "@/components/json-table/json-table-profiler"
import { useRefCallback } from "@/components/json-table/path-utils"
import type { JsonTableCellField } from "@/components/json-table/use-json-table-cell-field"
import type { JsonTablePrimitiveControl } from "@/components/json-table/use-json-table-primitive-control"

type ShellKeyEvent = React.KeyboardEvent<HTMLTableCellElement>
type ShellMouseEvent = React.MouseEvent<HTMLTableCellElement>
type ShellPointerEvent = React.PointerEvent<HTMLTableCellElement>

export function useJsonTableShellHandlers({
  props,
  cellField,
  primitiveControl,
}: {
  props: JsonTableCellProps
  cellField: JsonTableCellField
  primitiveControl: JsonTablePrimitiveControl
}): JsonTableShellHandlers {
  const shellActivationGuardRef = React.useRef(false)
  const {
    docId,
    onCellHoverEnd,
    onCellHoverStart,
    primitiveActiveCell,
    primitiveEditorHandleRef,
    projectedCell,
    setPrimitiveActiveCell,
    startStructuredEditSession,
  } = props
  const {
    cellId,
    dataCellKind,
    fieldMetadata,
    isCellEditing,
    isJsonEditable,
    isPrimitiveCell,
    isStructuredActive,
    materializedFieldPath,
  } = cellField
  const {
    commitPrimitiveValue,
    primitiveEffectiveValue,
    setActivationRequest,
    setPrimitiveActive,
  } = primitiveControl

  const finishPreviousPrimitive = useRefCallback(() => {
    finishPreviousPrimitiveEditor({
      currentCellId: cellId,
      primitiveActiveCell,
      primitiveEditorHandleRef,
      setPrimitiveActiveCell,
    })
  })

  const shellPointerEnter = useRefCallback((event: ShellPointerEvent) => {
    if (!materializedFieldPath || !isJsonEditable) return
    markJsonTableProfile("pointer-enter-cell", {
      fieldPath: materializedFieldPath,
    })
    onCellHoverStart?.({
      docId,
      fieldPath: materializedFieldPath,
      rect: event.currentTarget.getBoundingClientRect(),
    })
  })

  const shellPointerDown = useRefCallback((event: ShellPointerEvent) => {
    if (
      !projectedCell ||
      !materializedFieldPath ||
      !fieldMetadata ||
      !isJsonEditable ||
      event.button !== 0
    ) {
      return
    }

    if (isPrimitiveCell) {
      if (isJsonTableDataCellEventTarget(event.target)) return
      finishPreviousPrimitive()
      if (isCellEditing) return
      if (
        commitPrimitiveCommand({
          effectiveValue: primitiveEffectiveValue,
          fieldMetadata,
          commitPrimitiveValue,
        })
      ) {
        armShellActivationGuard(shellActivationGuardRef)
        return
      }

      setActivationRequest(shellActivationRequest())
      armShellActivationGuard(shellActivationGuardRef)
      setPrimitiveActive(true)
      return
    }

    finishPreviousPrimitive()
    if (isStructuredActive) return
    startStructuredEditSession(
      projectedCell,
      structuredPointerActivationIntent(event)
    )
  })

  const shellClick = useRefCallback((event: ShellMouseEvent) => {
    if (consumeShellActivationGuard(shellActivationGuardRef)) return
    if (
      !projectedCell ||
      !materializedFieldPath ||
      !fieldMetadata ||
      !isJsonEditable ||
      event.button !== 0 ||
      !isPrimitiveCell ||
      isCellEditing
    ) {
      return
    }

    finishPreviousPrimitive()
    if (
      commitPrimitiveCommand({
        effectiveValue: primitiveEffectiveValue,
        fieldMetadata,
        commitPrimitiveValue,
      })
    ) {
      return
    }

    setActivationRequest(shellActivationRequest())
    setPrimitiveActive(true)
  })

  const shellKeyDown = useRefCallback((event: ShellKeyEvent) => {
    if (
      !projectedCell ||
      !materializedFieldPath ||
      !fieldMetadata ||
      !isJsonEditable
    ) {
      return
    }

    finishPreviousPrimitive()

    if (isPrimitiveCell) {
      if (
        isCellEditing ||
        !canActivatePrimitiveFromShellKey({
          dataCellKind,
          event,
        })
      ) {
        return
      }

      event.preventDefault()
      if (
        commitPrimitiveCommand({
          effectiveValue: primitiveEffectiveValue,
          fieldMetadata,
          key: event.key,
          commitPrimitiveValue,
        })
      ) {
        armShellActivationGuard(shellActivationGuardRef)
        return
      }

      setActivationRequest(keyboardActivationRequest(event))
      setPrimitiveActive(true)
      return
    }

    if (isStructuredActive || !canActivateStructuredFromShellKey(event)) {
      return
    }

    event.preventDefault()
    startStructuredEditSession(
      projectedCell,
      structuredKeyboardActivationIntent(event)
    )
  })

  const shellPointerLeave = useRefCallback(() => {
    onCellHoverEnd?.()
  })

  return {
    onClick: shellClick,
    onKeyDown: shellKeyDown,
    onPointerDown: shellPointerDown,
    onPointerEnter: shellPointerEnter,
    onPointerLeave: shellPointerLeave,
    onPointerMove: shellPointerEnter,
  }
}
