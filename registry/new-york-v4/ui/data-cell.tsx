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
import {
  DataCellDisplay,
  type DataCellDisplayProps,
} from "@/registry/new-york-v4/ui/data-cell-display"
import { createDataCellEditModel } from "@/registry/new-york-v4/ui/data-cell-edit-model"
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

function dataCellDisplayProps(
  props: DataCellProps,
  shellProps: Pick<
    DataCellDisplayProps,
    | "disabled"
    | "editable"
    | "onClick"
    | "onKeyDown"
    | "onPointerDown"
    | "tabIndex"
  >
): DataCellDisplayProps {
  const {
    kind,
    value,
    placeholder,
    className,
    showPickerIcon,
    formatValue,
    mode,
    editable,
    active,
    disabled,
    name,
    selectOptions,
    dateTimeZone,
    activationSource,
    open,
    draftValue,
    autoFocus,
    onDraftValueChange,
    onCommit,
    onEditingEnd,
    onActiveChange,
    onOpenChange,
    onEditorHandleChange,
    onClick,
    onKeyDown,
    onPointerDown,
    ...surfaceDomProps
  } = props
  const displayProps: Pick<
    DataCellDisplayProps,
    "className" | "placeholder" | "showPickerIcon"
  > &
    Pick<
      DataCellDisplayProps,
      | "disabled"
      | "editable"
      | "onClick"
      | "onKeyDown"
      | "onPointerDown"
      | "tabIndex"
    > &
    React.HTMLAttributes<HTMLDivElement> = {
    ...surfaceDomProps,
    ...shellProps,
    placeholder,
    className,
    showPickerIcon,
  }

  switch (props.kind) {
    case "text":
      return {
        ...displayProps,
        kind: props.kind,
        value: props.value,
        formatValue: props.formatValue,
      }
    case "number":
    case "integer":
      return {
        ...displayProps,
        kind: props.kind,
        value: props.value,
        formatValue: props.formatValue,
      }
    case "boolean":
      return {
        ...displayProps,
        kind: props.kind,
        value: props.value,
        formatValue: props.formatValue,
      }
    case "select":
      return {
        ...displayProps,
        kind: props.kind,
        value: props.value,
        formatValue: props.formatValue,
      }
    case "date":
    case "time":
    case "date-time":
      return {
        ...displayProps,
        kind: props.kind,
        value: props.value,
        formatValue: props.formatValue,
        showPickerIcon: props.showPickerIcon ?? true,
      }
  }
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

  const editModel = createDataCellEditModel(props, {
    disabled,
    activationSource:
      props.activationSource ?? activationSource ?? activationSourceRef.current,
    autoFocus: props.autoFocus ?? canSelfActivate,
    onEditingEnd: endEditing,
    onEditorHandleChange: props.onEditorHandleChange,
  })

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
          controlState: editModel.controlState,
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
    [applyControlAction, canSelfActivate, editModel, onPointerDown, props]
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
          controlState: editModel.controlState,
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
      editModel,
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
          controlState: editModel.controlState,
          key: event.key,
        }),
        event,
        false
      )
    },
    [applyControlAction, canSelfActivate, editModel, onKeyDown]
  )

  if (isActive) {
    return <DataCellControl model={editModel} />
  }

  return (
    <DataCellDisplay
      {...dataCellDisplayProps(props, {
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
