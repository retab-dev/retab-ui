import * as React from "react"

import type { JsonTableShellHandlers } from "@/components/json-table/json-table-cell-shell"
import type { JsonTableCellProps } from "@/components/json-table/json-table-cell-types"
import {
  canActivateStructuredFromShellKey,
  structuredKeyboardActivationIntent,
  structuredPointerActivationIntent,
} from "@/components/json-table/json-table-primitive-activation"
import { finishPreviousPrimitiveEditor } from "@/components/json-table/json-table-primitive-handoff"
import { markJsonTableProfile } from "@/components/json-table/json-table-profiler"
import { useRefCallback } from "@/components/json-table/path-utils"
import type { JsonTableCellField } from "@/components/json-table/use-json-table-cell-field"

type ShellKeyEvent = React.KeyboardEvent<HTMLTableCellElement>
type ShellMouseEvent = React.MouseEvent<HTMLTableCellElement>
type ShellPointerEvent = React.PointerEvent<HTMLTableCellElement>

export function useJsonTableShellHandlers({
  props,
  cellField,
}: {
  props: JsonTableCellProps
  cellField: JsonTableCellField
}): JsonTableShellHandlers {
  const {
    docId,
    onCellHoverEnd,
    onCellHoverStart,
    primitiveEditorHandleRef,
    projectedCell,
    setPrimitiveActiveCell,
    startStructuredEditSession,
  } = props
  const {
    cellId,
    fieldMetadata,
    isJsonEditable,
    isPrimitiveCell,
    isStructuredActive,
    materializedFieldPath,
  } = cellField

  const finishPreviousPrimitive = useRefCallback(() => {
    finishPreviousPrimitiveEditor({
      currentCellId: cellId,
      primitiveActiveCell: props.primitiveActiveCellStore.getSnapshot(),
      primitiveEditorHandleRef,
      setPrimitiveActiveCell,
    })
  })

  const shellPointerEnter = useRefCallback((event: ShellPointerEvent) => {
    if (!materializedFieldPath || !isJsonEditable) return
    markJsonTableProfile("pointer-enter-cell", {
      fieldPath: materializedFieldPath,
    })
    const target = event.currentTarget
    onCellHoverStart?.({
      docId,
      fieldPath: materializedFieldPath,
      getRect: () => target.getBoundingClientRect(),
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
      return
    }

    finishPreviousPrimitive()
    if (isStructuredActive) return
    startStructuredEditSession(
      projectedCell,
      structuredPointerActivationIntent(event)
    )
  })

  const shellClick = useRefCallback((_event: ShellMouseEvent) => {})

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
