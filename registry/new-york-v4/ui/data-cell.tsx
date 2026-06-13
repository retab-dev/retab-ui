"use client"

import * as React from "react"
import { flushSync } from "react-dom"

import { useDataCellActivationClickTail } from "@/registry/new-york-v4/ui/data-cell-activation"
import { DataCellBooleanControl } from "@/registry/new-york-v4/ui/data-cell-boolean-control"
import type { DataCellControlAction } from "@/registry/new-york-v4/ui/data-cell-control-contract"
import {
  canActivateDataCellFromKey,
  DataCellControl,
  getDataCellClickControlAction,
  getDataCellKeyControlAction,
  getDataCellPointerControlAction,
} from "@/registry/new-york-v4/ui/data-cell-control-registry"
import { DataCellDisplay } from "@/registry/new-york-v4/ui/data-cell-display"
import {
  formatDataCellDisplayValue,
  parseDataCellNumberInput,
} from "@/registry/new-york-v4/ui/data-cell-format"
import { DataCellNumberControl } from "@/registry/new-york-v4/ui/data-cell-number-control"
import { DataCellPickerControl } from "@/registry/new-york-v4/ui/data-cell-picker-control"
import { DataCellSelectControl } from "@/registry/new-york-v4/ui/data-cell-select-control"
import { DataCellTextControl } from "@/registry/new-york-v4/ui/data-cell-text-control"
import type {
  DataCellActivationSource,
  DataCellCommitHandler,
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
export { formatDataCellDisplayValue, parseDataCellNumberInput }
export {
  createDataCellKeyboardActivationSource,
  createDataCellPointerActivationSource,
  createDataCellShellActivationSource,
  type DataCellActivationToken,
} from "@/registry/new-york-v4/ui/data-cell-activation"
export { DataCellBooleanControl }
export { DataCellControl, canActivateDataCellFromKey }
export { DataCellDisplay }
export { DataCellNumberControl }
export { DataCellPickerControl }
export { DataCellSelectControl }
export { DataCellTextControl }

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

export function DataCell({
  mode,
  active,
  editable = false,
  disabled = false,
  onActiveChange,
  onCommit,
  onEditingEnd,
  onEditorHandleChange,
  onClick,
  onKeyDown,
  onPointerDown,
  ...props
}: DataCellProps) {
  const displayRef = React.useRef<HTMLElement>(null)
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
        action.commit(onCommit as DataCellCommitHandler | undefined)
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
    [activationClickTail, onCommit, setActive]
  )

  const activateFromPointer = React.useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      onPointerDown?.(event)
      if (event.defaultPrevented || !canSelfActivate || event.button !== 0) {
        return
      }

      applyControlAction(
        getDataCellPointerControlAction({
          props,
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
    [applyControlAction, canSelfActivate, onPointerDown, props]
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
          props,
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
    [activationClickTail, applyControlAction, canSelfActivate, onClick, props]
  )

  const activateFromKey = React.useCallback(
    (event: React.KeyboardEvent<HTMLElement>) => {
      onKeyDown?.(event)
      if (event.defaultPrevented || !canSelfActivate) return

      if (hasDataCellKeyboardModifier(event)) return

      applyControlAction(
        getDataCellKeyControlAction({ props, key: event.key }),
        event,
        false
      )
    },
    [applyControlAction, canSelfActivate, onKeyDown, props]
  )

  if (isActive) {
    return (
      <DataCellControl
        {...props}
        editable={editable}
        disabled={disabled}
        activationSource={
          props.activationSource ??
          activationSource ??
          activationSourceRef.current
        }
        autoFocus={props.autoFocus ?? canSelfActivate}
        onCommit={onCommit as never}
        onEditingEnd={endEditing}
        onEditorHandleChange={onEditorHandleChange}
        onKeyDown={onKeyDown}
      />
    )
  }

  return (
    <DataCellDisplay
      {...props}
      ref={displayRef}
      editable={editable}
      disabled={disabled}
      onPointerDown={activateFromPointer}
      onClick={activateFromClick}
      onKeyDown={activateFromKey}
      tabIndex={editable && !disabled ? (props.tabIndex ?? 0) : props.tabIndex}
    />
  )
}
