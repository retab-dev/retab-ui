import type * as React from "react"

import type { DataCellActivationSource } from "@/registry/new-york-v4/ui/data-cell-activation"
import type { DataCellControlState } from "@/registry/new-york-v4/ui/data-cell-control-state"
import type { DataCellEditModelByKind } from "@/registry/new-york-v4/ui/data-cell-edit-model"
import type {
  DataCellDateTimeZone,
  DataCellEditorHandle,
  DataCellKind,
  DataCellSelectOption,
  DataCellValueMeta,
} from "@/registry/new-york-v4/ui/data-cell-types"

export type { DataCellControlState }

type DataCellInputNativeProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  | "children"
  | "className"
  | "defaultValue"
  | "disabled"
  | "name"
  | "onChange"
  | "placeholder"
  | "type"
  | "value"
>

type DataCellInputControlBaseProps<
  Kind extends DataCellKind,
  Value,
> = DataCellInputNativeProps & {
  kind: Kind
  value?: Value
  disabled?: boolean
  name?: string
  placeholder?: string
  className?: string
  draftValue?: string
  autoFocus?: boolean
  activationSource?: DataCellActivationSource
  onDraftValueChange?: (value: string, meta: DataCellValueMeta) => void
  onEditingEnd?: () => void
  onEditorHandleChange?: (handle: DataCellEditorHandle | null) => void
}

export type DataCellTextControlProps = DataCellInputControlBaseProps<
  "text",
  string | null
> & {
  onCommit?: (value: string | null, meta: DataCellValueMeta) => void
}

export type DataCellNumberControlProps = DataCellInputControlBaseProps<
  "number" | "integer",
  number | string | null
> & {
  onCommit?: (value: number | null, meta: DataCellValueMeta) => void
}

export type DataCellInputControlProps =
  | DataCellTextControlProps
  | DataCellNumberControlProps

type DataCellBooleanRootProps = Omit<
  React.HTMLAttributes<HTMLDivElement>,
  | "children"
  | "className"
  | "defaultValue"
  | "id"
  | "onBlur"
  | "onChange"
  | "onClick"
  | "onDoubleClick"
  | "onFocus"
  | "onKeyDown"
>

export type DataCellBooleanControlProps = DataCellBooleanRootProps & {
  kind: "boolean"
  value?: boolean | null
  disabled?: boolean
  name?: string
  className?: string
  autoFocus?: boolean
  id?: string
  "aria-label"?: string
  "aria-describedby"?: string
  "aria-invalid"?: boolean | "false" | "true" | "grammar" | "spelling"
  onCommit?: (value: boolean, meta: DataCellValueMeta) => void
  onEditingEnd?: () => void
  onEditorHandleChange?: (handle: DataCellEditorHandle | null) => void
  onFocus?: React.FocusEventHandler<HTMLButtonElement>
  onBlur?: React.FocusEventHandler<HTMLButtonElement>
  onKeyDown?: React.KeyboardEventHandler<HTMLButtonElement>
  onClick?: React.MouseEventHandler<HTMLButtonElement>
  onDoubleClick?: React.MouseEventHandler<HTMLButtonElement>
}

type DataCellSelectNativeProps = Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  | "children"
  | "className"
  | "defaultValue"
  | "disabled"
  | "name"
  | "onChange"
  | "type"
  | "value"
>

export type DataCellSelectFormatValue = (
  value: string | null | undefined,
  meta: { kind: "select" }
) => React.ReactNode

export type DataCellSelectControlProps = DataCellSelectNativeProps & {
  kind: "select"
  value?: string | null
  disabled?: boolean
  name?: string
  placeholder?: string
  className?: string
  formatValue?: DataCellSelectFormatValue
  autoFocus?: boolean
  activationSource?: DataCellActivationSource
  open?: boolean
  options: DataCellSelectOption[]
  onCommit?: (value: string | null, meta: DataCellValueMeta) => void
  onEditingEnd?: () => void
  onOpenChange?: (open: boolean) => void
  onEditorHandleChange?: (handle: DataCellEditorHandle | null) => void
}

type DataCellPickerNativeProps = Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  | "children"
  | "className"
  | "defaultValue"
  | "disabled"
  | "name"
  | "onChange"
  | "type"
  | "value"
>

export type DataCellPickerControlProps = DataCellPickerNativeProps & {
  kind: "date" | "time" | "date-time"
  value?: string | null
  disabled?: boolean
  name?: string
  placeholder?: string
  dateTimeZone?: DataCellDateTimeZone
  showPickerIcon?: boolean
  className?: string
  formatValue?: (
    value: string | null | undefined,
    meta: { kind: "date" | "time" | "date-time" }
  ) => React.ReactNode
  draftValue?: string
  autoFocus?: boolean
  activationSource?: DataCellActivationSource
  open?: boolean
  onDraftValueChange?: (value: string, meta: DataCellValueMeta) => void
  onCommit?: (value: string | null, meta: DataCellValueMeta) => void
  onOpenChange?: (open: boolean) => void
  onEditingEnd?: () => void
  onEditorHandleChange?: (handle: DataCellEditorHandle | null) => void
}

export type DataCellControlPropsByKind = {
  text: DataCellTextControlProps
  number: DataCellNumberControlProps
  integer: DataCellNumberControlProps
  boolean: DataCellBooleanControlProps
  select: DataCellSelectControlProps
  date: DataCellPickerControlProps
  time: DataCellPickerControlProps
  "date-time": DataCellPickerControlProps
}

export type DataCellControlPointerActionArgs<
  Kind extends DataCellKind = DataCellKind,
> = {
  controlState: Extract<DataCellControlState, { kind: Kind }>
  clientX: number
  clientY: number
  detail: number
  displayElement: HTMLElement | null
  event?: Event
}

export type DataCellControlKeyActionArgs<
  Kind extends DataCellKind = DataCellKind,
> = {
  controlState: Extract<DataCellControlState, { kind: Kind }>
  key: string
}

export type DataCellControlAction =
  | {
      kind: "none"
    }
  | {
      kind: "edit"
      activationSource: DataCellActivationSource
      shouldPreventDefault: boolean
    }
  | {
      kind: "command"
      commit: () => void
      shouldPreventDefault: boolean
    }

export type DataCellControlAdapter<Kind extends DataCellKind = DataCellKind> = {
  Control: React.ComponentType<DataCellControlPropsByKind[Kind]>
  controlProps: (
    model: DataCellEditModelByKind[Kind]
  ) => DataCellControlPropsByKind[Kind]
  activatePointer: (
    args: DataCellControlPointerActionArgs<Kind>
  ) => DataCellControlAction
  activateClick: (
    args: DataCellControlPointerActionArgs<Kind>
  ) => DataCellControlAction
  activateKey: (
    args: DataCellControlKeyActionArgs<Kind>
  ) => DataCellControlAction
  canActivateFromKey: (key: string) => boolean
}

export function noneDataCellControlAction(): DataCellControlAction {
  return { kind: "none" }
}

export function editDataCellControlAction(
  activationSource: DataCellActivationSource,
  { shouldPreventDefault }: { shouldPreventDefault: boolean }
): DataCellControlAction {
  return {
    kind: "edit",
    activationSource,
    shouldPreventDefault,
  }
}

export function commandDataCellControlAction(
  commit: () => void,
  { shouldPreventDefault }: { shouldPreventDefault: boolean }
): DataCellControlAction {
  return {
    kind: "command",
    commit,
    shouldPreventDefault,
  }
}
