import type * as React from "react"

import type { DataCellActivationSource } from "@/registry/new-york-v4/ui/data-cell-activation"
import type { DataCellEditorProps } from "@/registry/new-york-v4/ui/data-cell-edit-model"
import type {
  DataCellDateTimeZone,
  DataCellKind,
  DataCellSelectOption,
  DataCellValueForKind,
  DataCellValueMeta,
} from "@/registry/new-york-v4/ui/data-cell-types"
import type { DataCellPrimitiveSession } from "@/registry/new-york-v4/ui/data-cell-session"

export type DataCellDraftControl = {
  value?: string
  onChange?: (value: string, meta: DataCellValueMeta) => void
}

export type DataCellOpenControl = {
  value?: boolean
  onChange?: (open: boolean) => void
}

type DataCellInputControlBaseProps<
  Kind extends DataCellKind,
  Value,
> = DataCellEditorProps & {
  kind: Kind
  value?: Value
  disabled?: boolean
  name?: string
  placeholder?: string
  className?: string
  autoFocus?: boolean
  activationSource?: DataCellActivationSource
  session: DataCellPrimitiveSession
  draft?: DataCellDraftControl
}

export type DataCellTextControlProps = DataCellInputControlBaseProps<
  "text",
  string | null
>

export type DataCellNumberControlProps = DataCellInputControlBaseProps<
  "number" | "integer",
  number | string | null
>

export type DataCellInputControlProps =
  | DataCellTextControlProps
  | DataCellNumberControlProps

export type DataCellBooleanControlProps = DataCellEditorProps & {
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
  session: DataCellPrimitiveSession
}

export type DataCellSelectFormatValue = (
  value: string | null | undefined,
  meta: { kind: "select" }
) => React.ReactNode

export type DataCellSelectControlProps = DataCellEditorProps & {
  kind: "select"
  value?: string | null
  disabled?: boolean
  name?: string
  placeholder?: string
  className?: string
  formatValue?: DataCellSelectFormatValue
  autoFocus?: boolean
  activationSource?: DataCellActivationSource
  options: DataCellSelectOption[]
  session: DataCellPrimitiveSession
  openState?: DataCellOpenControl
}

export type DataCellPickerControlProps = DataCellEditorProps & {
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
  autoFocus?: boolean
  activationSource?: DataCellActivationSource
  session: DataCellPrimitiveSession
  draft?: DataCellDraftControl
  openState?: DataCellOpenControl
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

export type DataCellControlStaticPropsByKind = {
  [Kind in DataCellKind]: Omit<DataCellControlPropsByKind[Kind], "session">
}

type DataCellBooleanCommitHandler = (
  value: boolean,
  meta: DataCellValueMeta
) => void

type DataCellControlStateForKind<Kind extends DataCellKind> = {
  kind: Kind
  value?: DataCellValueForKind<Kind>
  disabled: boolean
} & (Kind extends "boolean"
  ? { commitBoolean?: DataCellBooleanCommitHandler }
  : {})

export type DataCellControlStateByKind = {
  [Kind in DataCellKind]: DataCellControlStateForKind<Kind>
}

export type DataCellControlState = DataCellControlStateByKind[DataCellKind]

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
