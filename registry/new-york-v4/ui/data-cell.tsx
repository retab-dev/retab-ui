"use client"

import * as React from "react"
import { flushSync } from "react-dom"

import { useDataCellActivationClickTail } from "@/registry/new-york-v4/ui/data-cell-activation"
import type { DataCellControlAction } from "@/registry/new-york-v4/ui/data-cell-control-contract"
import {
  DataCellControl,
  getDataCellClickControlAction,
  getDataCellKeyControlAction,
  getDataCellPointerControlAction,
} from "@/registry/new-york-v4/ui/data-cell-control-registry"
import { createDataCellControlState } from "@/registry/new-york-v4/ui/data-cell-control-state"
import { DataCellDisplay } from "@/registry/new-york-v4/ui/data-cell-display"
import { createDataCellDisplayProps } from "@/registry/new-york-v4/ui/data-cell-display-model"
import { createDataCellEditModel } from "@/registry/new-york-v4/ui/data-cell-edit-model"
import type {
  DataCellActivationSource,
  DataCellProps,
} from "@/registry/new-york-v4/ui/data-cell-types"

export type {
  DataCellActivationSource,
  DataCellCommitValue,
  DataCellDateTimeZone,
  DataCellEditorHandle,
  DataCellKind,
  DataCellMode,
  DataCellProps,
  DataCellSelectOption,
  DataCellValue,
  DataCellValueMeta,
} from "@/registry/new-york-v4/ui/data-cell-types"
export {
  formatDataCellDisplayValue,
  parseDataCellNumberInput,
} from "@/registry/new-york-v4/ui/data-cell-format"
export {
  createDataCellKeyboardActivationSource,
  createDataCellPointerActivationSource,
  createDataCellShellActivationSource,
  type DataCellActivationToken,
} from "@/registry/new-york-v4/ui/data-cell-activation"
export { DataCellBooleanControl } from "@/registry/new-york-v4/ui/data-cell-boolean-control"
export {
  canActivateDataCellFromKey,
  DataCellControl,
} from "@/registry/new-york-v4/ui/data-cell-control-registry"
export { DataCellDisplay }
export { DataCellNumberControl } from "@/registry/new-york-v4/ui/data-cell-number-control"
export { DataCellPickerControl } from "@/registry/new-york-v4/ui/data-cell-picker-control"
export { DataCellSelectControl } from "@/registry/new-york-v4/ui/data-cell-select-control"
export { DataCellTextControl } from "@/registry/new-york-v4/ui/data-cell-text-control"

function storeDataCellActivationSource(
  sourceRef: React.MutableRefObject<DataCellActivationSource | undefined>,
  setSource: React.Dispatch<
    React.SetStateAction<DataCellActivationSource | undefined>
  >,
  source: DataCellActivationSource
) {
  flushSync(() => {
    sourceRef.current = source
    setSource(source)
  })
}

function hasDataCellKeyboardModifier(event: React.KeyboardEvent<HTMLElement>) {
  const isAltGraph =
    event.getModifierState("AltGraph") ||
    event.nativeEvent.getModifierState?.("AltGraph") ||
    (event.ctrlKey &&
      event.altKey &&
      event.key.length === 1 &&
      !/^[\x00-\x7F]$/.test(event.key))
  return (
    event.metaKey ||
    (event.ctrlKey && !isAltGraph) ||
    (event.altKey && !isAltGraph) ||
    event.nativeEvent.isComposing
  )
}

export function DataCell(props: DataCellProps) {
  const {
    mode,
    active,
    editable = false,
    disabled = false,
    onActiveChange,
    onEditingEnd,
    onClick,
    onKeyDown,
    onPointerDown,
  } = props
  const displayRef = React.useRef<HTMLDivElement>(null)
  const activationClickTail = useDataCellActivationClickTail()
  const activationSourceRef = React.useRef<
    DataCellActivationSource | undefined
  >(undefined)
  const [uncontrolledActive, setUncontrolledActive] = React.useState(false)
  const [activationSource, setActivationSource] =
    React.useState<DataCellActivationSource>()
  const isControlledActive = active !== undefined
  const isExplicitMode = mode !== undefined
  const isActive =
    active ?? (isExplicitMode ? mode === "edit" : uncontrolledActive)
  const canSelfActivate =
    editable && !disabled && (!isExplicitMode || isControlledActive)

  const setActive = React.useCallback(
    (nextActive: boolean) => {
      if (!isControlledActive) setUncontrolledActive(nextActive)
      onActiveChange?.(nextActive)
    },
    [isControlledActive, onActiveChange]
  )

  const endEditing = React.useCallback(() => {
    activationSourceRef.current = undefined
    setActive(false)
    onEditingEnd?.()
  }, [onEditingEnd, setActive])

  const controlState = createDataCellControlState(props, { disabled })

  const applyControlAction = React.useCallback(
    (
      action: DataCellControlAction,
      event:
        | React.PointerEvent<HTMLElement>
        | React.MouseEvent<HTMLElement>
        | React.KeyboardEvent<HTMLElement>,
      markClickTail: boolean
    ) => {
      if (action.kind === "none") return
      if (action.shouldPreventDefault) event.preventDefault()
      event.stopPropagation()
      if (action.kind === "command") {
        action.commit()
        if (markClickTail) activationClickTail.arm()
        return
      }
      storeDataCellActivationSource(
        activationSourceRef,
        setActivationSource,
        action.activationSource
      )
      if (markClickTail) activationClickTail.arm()
      setActive(true)
    },
    [activationClickTail, setActive]
  )

  const activateFromPointer = React.useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      onPointerDown?.(event)
      if (event.defaultPrevented || !canSelfActivate || event.button !== 0) {
        return
      }

      applyControlAction(
        getDataCellPointerControlAction({
          controlState,
          clientX: event.clientX,
          clientY: event.clientY,
          detail: event.detail,
          displayElement: displayRef.current,
          event: event.nativeEvent,
        }),
        event,
        true
      )
    },
    [applyControlAction, canSelfActivate, controlState, onPointerDown]
  )

  const activateFromClick = React.useCallback(
    (event: React.MouseEvent<HTMLElement>) => {
      onClick?.(event)
      if (activationClickTail.consume()) {
        event.stopPropagation()
        return
      }
      if (event.defaultPrevented || !canSelfActivate) return

      applyControlAction(
        getDataCellClickControlAction({
          controlState,
          clientX: event.clientX,
          clientY: event.clientY,
          detail: event.detail,
          displayElement: displayRef.current,
          event: event.nativeEvent,
        }),
        event,
        false
      )
    },
    [
      activationClickTail,
      applyControlAction,
      canSelfActivate,
      controlState,
      onClick,
    ]
  )

  const activateFromKey = React.useCallback(
    (event: React.KeyboardEvent<HTMLElement>) => {
      onKeyDown?.(event)
      if (event.defaultPrevented || !canSelfActivate) return

      if (hasDataCellKeyboardModifier(event)) return

      applyControlAction(
        getDataCellKeyControlAction({
          controlState,
          key: event.key,
        }),
        event,
        false
      )
    },
    [applyControlAction, canSelfActivate, controlState, onKeyDown]
  )

  if (isActive) {
    const editModel = createDataCellEditModel(props, {
      disabled,
      activationSource:
        props.activationSource ??
        activationSource ??
        activationSourceRef.current,
      autoFocus: props.autoFocus ?? canSelfActivate,
      onEditingEnd: endEditing,
      onEditorHandleChange: props.onEditorHandleChange,
    })
    return <DataCellControl model={editModel} />
  }

  return (
    <DataCellDisplay
      {...createDataCellDisplayProps(props, {
        editable,
        disabled,
        onPointerDown: activateFromPointer,
        onClick: activateFromClick,
        onKeyDown: activateFromKey,
        tabIndex:
          editable && !disabled ? (props.tabIndex ?? 0) : props.tabIndex,
      })}
      ref={displayRef}
    />
  )
}
