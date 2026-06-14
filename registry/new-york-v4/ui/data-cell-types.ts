import type * as React from "react"

import type { DataCellActivationRequest } from "@/registry/new-york-v4/ui/data-cell-activation"

export type DataCellKindModel = {
  text: {
    value: string | null
    commitValue: string | null
  }
  number: {
    value: number | string | null
    commitValue: number | null
  }
  integer: {
    value: number | string | null
    commitValue: number | null
  }
  boolean: {
    value: boolean | null
    commitValue: boolean
  }
  select: {
    value: string | null
    commitValue: string | null
  }
  date: {
    value: string | null
    commitValue: string | null
  }
  time: {
    value: string | null
    commitValue: string | null
  }
  "date-time": {
    value: string | null
    commitValue: string | null
  }
}

export type DataCellKind = keyof DataCellKindModel

export type DataCellMode = "display" | "edit"
export type DataCellValueForKind<Kind extends DataCellKind> =
  DataCellKindModel[Kind]["value"]
export type DataCellCommitValueForKind<Kind extends DataCellKind> =
  DataCellKindModel[Kind]["commitValue"]
export type DataCellValue = DataCellValueForKind<DataCellKind> | undefined
export type DataCellCommitValue = DataCellCommitValueForKind<DataCellKind>
export type DataCellDateTimeZone = "local" | "preserve" | "utc"

export type { DataCellActivationRequest }

export type DataCellValueMeta = {
  kind: DataCellKind
  rawValue: string
  isEmpty: boolean
  isValid: boolean
}

export type DataCellSelectOption = {
  value: string
  label: React.ReactNode
  disabled?: boolean
  className?: string
}

export type DataCellCommitHandler = (
  value: DataCellCommitValue,
  meta: DataCellValueMeta
) => void

export type DataCellEditorHandle = {
  finish: () => void
  cancel: () => void
}

type DataCellNativeProps = Omit<
  React.HTMLAttributes<HTMLElement>,
  "children" | "defaultValue" | "onChange"
>

type DataCellBaseProps<Kind extends DataCellKind> = DataCellNativeProps & {
  kind: Kind
  value?: DataCellValueForKind<Kind>
  mode?: DataCellMode
  editable?: boolean
  active?: boolean
  disabled?: boolean
  name?: string
  activationRequest?: DataCellActivationRequest
  autoFocus?: boolean
  onEditingEnd?: () => void
  onActiveChange?: (active: boolean) => void
  onEditorHandleChange?: (handle: DataCellEditorHandle | null) => void
}

type DataCellPlaceholderProps = {
  placeholder?: string
}

type DataCellDraftProps = {
  draftValue?: string
  onDraftValueChange?: (value: string, meta: DataCellValueMeta) => void
}

type DataCellOpenProps = {
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

type DataCellFormatProps<Kind extends DataCellKind> = {
  formatValue?: (
    value: DataCellValueForKind<Kind> | undefined,
    meta: { kind: Kind }
  ) => React.ReactNode
}

type DataCellCommitProps<Kind extends DataCellKind> = {
  onCommit?: (
    value: DataCellCommitValueForKind<Kind>,
    meta: DataCellValueMeta
  ) => void
}

type DataCellTextProps = DataCellBaseProps<"text"> &
  DataCellPlaceholderProps &
  DataCellDraftProps &
  DataCellFormatProps<"text"> &
  DataCellCommitProps<"text">

type DataCellNumberProps = DataCellBaseProps<"number"> &
  DataCellPlaceholderProps &
  DataCellDraftProps &
  DataCellFormatProps<"number"> &
  DataCellCommitProps<"number">

type DataCellIntegerProps = DataCellBaseProps<"integer"> &
  DataCellPlaceholderProps &
  DataCellDraftProps &
  DataCellFormatProps<"integer"> &
  DataCellCommitProps<"integer">

type DataCellBooleanProps = DataCellBaseProps<"boolean"> &
  DataCellCommitProps<"boolean">

type DataCellSelectProps = DataCellBaseProps<"select"> &
  DataCellPlaceholderProps &
  DataCellOpenProps &
  DataCellFormatProps<"select"> & {
    selectOptions: DataCellSelectOption[]
  } & DataCellCommitProps<"select">

type DataCellPickerProps<Kind extends "date" | "time" | "date-time"> =
  DataCellBaseProps<Kind> &
    DataCellPlaceholderProps &
    DataCellDraftProps &
    DataCellOpenProps &
    DataCellFormatProps<Kind> & {
      dateTimeZone?: DataCellDateTimeZone
      showPickerIcon?: boolean
    } & DataCellCommitProps<Kind>

export type DataCellPropsByKind = {
  text: DataCellTextProps
  number: DataCellNumberProps
  integer: DataCellIntegerProps
  boolean: DataCellBooleanProps
  select: DataCellSelectProps
  date: DataCellPickerProps<"date">
  time: DataCellPickerProps<"time">
  "date-time": DataCellPickerProps<"date-time">
}

export type DataCellPropsForKind<Kind extends DataCellKind> =
  DataCellPropsByKind[Kind]

export type DataCellProps = DataCellPropsByKind[DataCellKind]
