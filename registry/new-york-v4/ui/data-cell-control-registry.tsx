"use client"

import * as React from "react"

import {
  createDataCellKeyboardActivationSource,
  createDataCellPointerActivationSource,
} from "@/registry/new-york-v4/ui/data-cell-activation"
import {
  commitDataCellBooleanToggle,
  DataCellBooleanControl,
} from "@/registry/new-york-v4/ui/data-cell-boolean-control"
import {
  commandDataCellControlAction,
  editDataCellControlAction,
  noneDataCellControlAction,
  type DataCellControlAction,
  type DataCellControlAdapter,
  type DataCellControlKeyActionArgs,
  type DataCellControlPointerActionArgs,
} from "@/registry/new-york-v4/ui/data-cell-control-contract"
import {
  canActivateDataCellNumberFromKey,
  DataCellNumberControl,
} from "@/registry/new-york-v4/ui/data-cell-number-control"
import { DataCellPickerControl } from "@/registry/new-york-v4/ui/data-cell-picker-control"
import {
  DataCellSelectControl,
  type DataCellSelectControlProps,
} from "@/registry/new-york-v4/ui/data-cell-select-control"
import {
  DataCellTextControl,
  getDataCellTextPointerActivationSource,
} from "@/registry/new-york-v4/ui/data-cell-text-control"
import type {
  DataCellKind,
  DataCellProps,
} from "@/registry/new-york-v4/ui/data-cell-types"

const keyboardOpenKeys = new Set(["Enter", "F2", " "])

const textControlAdapter: DataCellControlAdapter = {
  Control: DataCellTextControl as React.ComponentType<DataCellProps>,
  activatePointer: (args) =>
    editDataCellControlAction(
      getDataCellTextPointerActivationSource({
        clientX: args.clientX,
        clientY: args.clientY,
        detail: args.detail,
        displayElement: args.displayElement,
        event: args.event,
        value: args.props.value as string | null | undefined,
      }),
      { shouldPreventDefault: true }
    ),
  activateClick: (args) =>
    editDataCellControlAction(
      getDataCellTextPointerActivationSource({
        clientX: args.clientX,
        clientY: args.clientY,
        detail: args.detail,
        displayElement: args.displayElement,
        event: args.event,
        value: args.props.value as string | null | undefined,
      }),
      { shouldPreventDefault: false }
    ),
  activateKey: ({ key }) =>
    editDataCellControlAction(createDataCellKeyboardActivationSource(key), {
      shouldPreventDefault: true,
    }),
  canActivateFromKey: (key) =>
    key === "Enter" || key === "F2" || key.length === 1,
}

function createInputControlAdapter(
  kind: "number" | "integer"
): DataCellControlAdapter {
  return {
    Control: DataCellNumberControl as React.ComponentType<DataCellProps>,
    activatePointer: createDefaultPointerEditAction,
    activateClick: createDefaultClickEditAction,
    activateKey: ({ key }) =>
      editDataCellControlAction(createDataCellKeyboardActivationSource(key), {
        shouldPreventDefault: true,
      }),
    canActivateFromKey: (key) => canActivateDataCellNumberFromKey(kind, key),
  }
}

const booleanControlAdapter: DataCellControlAdapter = {
  Control: DataCellBooleanControl as React.ComponentType<DataCellProps>,
  activatePointer: ({ props }) =>
    commandDataCellControlAction(
      (onCommit) =>
        commitDataCellBooleanToggle(
          props.value as boolean | null | undefined,
          onCommit
        ),
      { shouldPreventDefault: true }
    ),
  activateClick: ({ props }) =>
    commandDataCellControlAction(
      (onCommit) =>
        commitDataCellBooleanToggle(
          props.value as boolean | null | undefined,
          onCommit
        ),
      { shouldPreventDefault: false }
    ),
  activateKey: ({ key, props }) => {
    if (key !== " ") {
      return editDataCellControlAction(
        createDataCellKeyboardActivationSource(key),
        {
          shouldPreventDefault: true,
        }
      )
    }
    return commandDataCellControlAction(
      (onCommit) =>
        commitDataCellBooleanToggle(
          props.value as boolean | null | undefined,
          onCommit
        ),
      { shouldPreventDefault: true }
    )
  },
  canActivateFromKey: (key) => key === "Enter" || key === "F2" || key === " ",
}

const selectControlAdapter: DataCellControlAdapter = {
  Control: DataCellSelectControlAdapter,
  activatePointer: noneDataCellControlAction,
  activateClick: createDefaultClickEditAction,
  activateKey: createKeyboardOpenAction,
  canActivateFromKey: (key) => keyboardOpenKeys.has(key),
}

const pickerControlAdapter: DataCellControlAdapter = {
  Control: DataCellPickerControl as React.ComponentType<DataCellProps>,
  activatePointer: createDefaultPointerEditAction,
  activateClick: createDefaultClickEditAction,
  activateKey: createKeyboardOpenAction,
  canActivateFromKey: (key) => keyboardOpenKeys.has(key),
}

const numberControlAdapter = createInputControlAdapter("number")
const integerControlAdapter = createInputControlAdapter("integer")

export function getDataCellControlAdapter(
  kind: DataCellKind
): DataCellControlAdapter {
  if (kind === "text") return textControlAdapter
  if (kind === "number") return numberControlAdapter
  if (kind === "integer") return integerControlAdapter
  if (kind === "boolean") return booleanControlAdapter
  if (kind === "select") return selectControlAdapter
  return pickerControlAdapter
}

export function DataCellControl(props: DataCellProps) {
  const Control = getDataCellControlAdapter(props.kind).Control
  return <Control {...props} />
}

function DataCellSelectControlAdapter(props: DataCellProps) {
  return <DataCellSelectControl {...dataCellSelectControlProps(props)} />
}

function dataCellSelectControlProps(
  props: DataCellProps
): DataCellSelectControlProps {
  if (props.kind !== "select") {
    throw new Error("DataCell select control received non-select props")
  }

  return {
    value: props.value,
    disabled: props.disabled,
    placeholder: props.placeholder,
    className: props.className,
    formatValue: props.formatValue,
    autoFocus: props.autoFocus,
    activationSource: props.activationSource,
    isPickerOpen: props.isPickerOpen,
    selectOptions: props.selectOptions,
    onCommit: props.onCommit,
    onEditingEnd: props.onEditingEnd,
    onPickerOpenChange: props.onPickerOpenChange,
    onEditorHandleChange: props.onEditorHandleChange,
  }
}

export function getDataCellPointerControlAction(
  args: DataCellControlPointerActionArgs
): DataCellControlAction {
  return getDataCellControlAdapter(args.props.kind).activatePointer(args)
}

export function getDataCellClickControlAction(
  args: DataCellControlPointerActionArgs
): DataCellControlAction {
  return getDataCellControlAdapter(args.props.kind).activateClick(args)
}

export function getDataCellKeyControlAction(
  args: DataCellControlKeyActionArgs
): DataCellControlAction {
  if (!canActivateDataCellFromKey(args.props.kind, args.key)) {
    return noneDataCellControlAction()
  }
  return getDataCellControlAdapter(args.props.kind).activateKey(args)
}

export function canActivateDataCellFromKey(
  kind: DataCellKind,
  key: string
): boolean {
  return getDataCellControlAdapter(kind).canActivateFromKey(key)
}

function createDefaultPointerEditAction({
  clientX,
  clientY,
  detail,
  event,
}: DataCellControlPointerActionArgs): DataCellControlAction {
  return editDataCellControlAction(
    createDataCellPointerActivationSource({ clientX, clientY, detail, event }),
    { shouldPreventDefault: true }
  )
}

function createDefaultClickEditAction({
  clientX,
  clientY,
  detail,
  event,
}: DataCellControlPointerActionArgs): DataCellControlAction {
  return editDataCellControlAction(
    createDataCellPointerActivationSource({ clientX, clientY, detail, event }),
    { shouldPreventDefault: false }
  )
}

function createKeyboardOpenAction({
  key,
}: DataCellControlKeyActionArgs): DataCellControlAction {
  return editDataCellControlAction(
    createDataCellKeyboardActivationSource(key),
    {
      shouldPreventDefault: true,
    }
  )
}
