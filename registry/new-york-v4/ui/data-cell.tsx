"use client"

import * as React from "react"
import { flushSync } from "react-dom"

import { DataCellBooleanControl } from "@/registry/new-york-v4/ui/data-cell-boolean-control"
import { DataCellDisplay } from "@/registry/new-york-v4/ui/data-cell-display"
import {
  formatDataCellDisplayValue,
  parseDataCellNumberInput,
} from "@/registry/new-york-v4/ui/data-cell-format"
import { DataCellNumberControl } from "@/registry/new-york-v4/ui/data-cell-number-control"
import { DataCellPickerControl } from "@/registry/new-york-v4/ui/data-cell-picker-control"
import { DataCellSelectControl } from "@/registry/new-york-v4/ui/data-cell-select-control"
import { DataCellTextControl } from "@/registry/new-york-v4/ui/data-cell-text-control"
import { getDataCellDisplayTextSelectionOffset } from "@/registry/new-york-v4/ui/data-cell-text-hit-test"
import type {
  DataCellActivationIntent,
  DataCellCommitHandler,
  DataCellKind,
  DataCellProps,
} from "@/registry/new-york-v4/ui/data-cell-types"

type DataCellBooleanControlProps = DataCellProps & { kind: "boolean" }
type DataCellPickerControlProps = DataCellProps & {
  kind: "date" | "time" | "date-time"
}
type DataCellNumberControlProps = DataCellProps & {
  kind: "number" | "integer"
}
type DataCellSelectControlProps = DataCellProps & { kind: "select" }
type DataCellTextControlProps = DataCellProps & { kind: "text" }

export type {
  DataCellActivationIntent,
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
export { DataCellBooleanControl }
export { DataCellDisplay }
export { DataCellNumberControl }
export { DataCellPickerControl }
export { DataCellSelectControl }
export { DataCellTextControl }

const dataCellNumberKeyPattern = /^[0-9.+-]$/

function storeDataCellActivationIntent(
  intentRef: React.MutableRefObject<DataCellActivationIntent | undefined>,
  setIntent: React.Dispatch<
    React.SetStateAction<DataCellActivationIntent | undefined>
  >,
  intent: DataCellActivationIntent
) {
  flushSync(() => {
    intentRef.current = intent
    setIntent(intent)
  })
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
  const didActivateBeforeClickRef = React.useRef(false)
  const activationIntentRef = React.useRef<DataCellActivationIntent | undefined>(
    undefined
  )
  const [uncontrolledActive, setUncontrolledActive] = React.useState(false)
  const [activationIntent, setActivationIntent] =
    React.useState<DataCellActivationIntent>()
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
    activationIntentRef.current = undefined
    setActive(false)
    onEditingEnd?.()
  }, [onEditingEnd, setActive])

  const commitBooleanDisplayValue = React.useCallback(() => {
    if (props.kind !== "boolean") return
    const nextValue = !Boolean(props.value)
    ;(onCommit as DataCellCommitHandler | undefined)?.(nextValue, {
      kind: "boolean",
      rawValue: String(nextValue),
      isEmpty: false,
      isValid: true,
    })
  }, [onCommit, props.kind, props.value])

  const activateFromPointer = React.useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      onPointerDown?.(event)
      if (event.defaultPrevented || !canSelfActivate || event.button !== 0) {
        return
      }

      event.stopPropagation()
      if (props.kind === "boolean") {
        event.preventDefault()
        commitBooleanDisplayValue()
        didActivateBeforeClickRef.current = true
        return
      }

      const intent: DataCellActivationIntent = {
        type: "pointer",
        clientX: event.clientX,
        clientY: event.clientY,
        detail: event.detail,
      }
      if (props.kind === "text") {
        const textElement = displayRef.current?.querySelector<HTMLElement>(
          '[data-slot="data-cell-value"]'
        )
        if (textElement) {
          intent.selectionOffset = getDataCellDisplayTextSelectionOffset({
            clientX: event.clientX,
            clientY: event.clientY,
            textElement,
            value:
              props.value === null || props.value === undefined
                ? ""
                : String(props.value),
          })
        }
      }
      storeDataCellActivationIntent(
        activationIntentRef,
        setActivationIntent,
        intent
      )
      didActivateBeforeClickRef.current = true
      setActive(true)
    },
    [
      canSelfActivate,
      commitBooleanDisplayValue,
      onPointerDown,
      props.kind,
      props.value,
      setActive,
    ]
  )

  const activateFromClick = React.useCallback(
    (event: React.MouseEvent<HTMLElement>) => {
      onClick?.(event)
      if (didActivateBeforeClickRef.current) {
        didActivateBeforeClickRef.current = false
        event.stopPropagation()
        return
      }
      if (event.defaultPrevented || !canSelfActivate) return

      event.stopPropagation()
      if (props.kind === "boolean") {
        commitBooleanDisplayValue()
        return
      }

      const intent: DataCellActivationIntent = {
        type: "pointer",
        clientX: event.clientX,
        clientY: event.clientY,
        detail: event.detail,
      }
      if (props.kind === "text") {
        const textElement = displayRef.current?.querySelector<HTMLElement>(
          '[data-slot="data-cell-value"]'
        )
        if (textElement) {
          intent.selectionOffset = getDataCellDisplayTextSelectionOffset({
            clientX: event.clientX,
            clientY: event.clientY,
            textElement,
            value:
              props.value === null || props.value === undefined
                ? ""
                : String(props.value),
          })
        }
      }
      storeDataCellActivationIntent(
        activationIntentRef,
        setActivationIntent,
        intent
      )
      setActive(true)
    },
    [
      canSelfActivate,
      commitBooleanDisplayValue,
      onClick,
      props.kind,
      props.value,
      setActive,
    ]
  )

  const activateFromKey = React.useCallback(
    (event: React.KeyboardEvent<HTMLElement>) => {
      onKeyDown?.(event)
      if (event.defaultPrevented || !canSelfActivate) return

      const isAltGraph =
        event.getModifierState("AltGraph") ||
        event.nativeEvent.getModifierState?.("AltGraph") ||
        (event.ctrlKey &&
          event.altKey &&
          event.key.length === 1 &&
          !/^[\x00-\x7F]$/.test(event.key))
      if (
        event.metaKey ||
        (event.ctrlKey && !isAltGraph) ||
        (event.altKey && !isAltGraph) ||
        event.nativeEvent.isComposing
      ) {
        return
      }

      if (props.kind === "boolean" && event.key === " ") {
        event.preventDefault()
        event.stopPropagation()
        commitBooleanDisplayValue()
        return
      }

      if (!canActivateDataCellFromKey(props.kind, event.key)) return
      event.preventDefault()
      event.stopPropagation()
      const intent: DataCellActivationIntent = {
        type: "keyboard",
        key: event.key,
      }
      storeDataCellActivationIntent(
        activationIntentRef,
        setActivationIntent,
        intent
      )
      setActive(true)
    },
    [
      canSelfActivate,
      commitBooleanDisplayValue,
      onKeyDown,
      props.kind,
      setActive,
    ]
  )

  if (isActive) {
    return (
      <DataCellControl
        {...props}
        editable={editable}
        disabled={disabled}
        activationIntent={
          props.activationIntent ??
          activationIntent ??
          activationIntentRef.current
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

export function DataCellControl(props: DataCellProps) {
  if (props.kind === "boolean") {
    return (
      <DataCellBooleanControl {...(props as DataCellBooleanControlProps)} />
    )
  }
  if (
    props.kind === "date" ||
    props.kind === "time" ||
    props.kind === "date-time"
  ) {
    return <DataCellPickerControl {...(props as DataCellPickerControlProps)} />
  }
  if (props.kind === "number" || props.kind === "integer") {
    return <DataCellNumberControl {...(props as DataCellNumberControlProps)} />
  }
  if (props.kind === "select") {
    return <DataCellSelectControl {...(props as DataCellSelectControlProps)} />
  }
  return <DataCellTextControl {...(props as DataCellTextControlProps)} />
}

export function canActivateDataCellFromKey(
  kind: DataCellKind,
  key: string
): boolean {
  if (key === "Enter" || key === "F2") return true
  if (kind === "boolean") return key === " "
  if (
    kind === "select" ||
    kind === "date" ||
    kind === "time" ||
    kind === "date-time"
  ) {
    return key === " "
  }
  if (key.length !== 1) return false
  if (kind === "integer") return /^[+-]$|^\d$/.test(key)
  if (kind === "number") return dataCellNumberKeyPattern.test(key)
  return kind === "text"
}
