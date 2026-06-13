import type * as React from "react"

import type { DataCellActivationSource } from "@/registry/new-york-v4/ui/data-cell-activation"

export type DataCellKind =
  | "text"
  | "number"
  | "integer"
  | "boolean"
  | "select"
  | "date"
  | "time"
  | "date-time"

export type DataCellMode = "display" | "edit"
export type DataCellValue = string | number | boolean | null | undefined
export type DataCellCommitValue = string | number | boolean | null
export type DataCellDateTimeZone = "local" | "preserve" | "utc"

export type { DataCellActivationSource }

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

type DataCellBaseProps<Kind extends DataCellKind, Value> = Omit<
  React.HTMLAttributes<HTMLElement>,
  "children" | "defaultValue" | "onChange"
> & {
  kind: Kind
  value?: Value
  mode?: DataCellMode
  editable?: boolean
  active?: boolean
  disabled?: boolean
  name?: string
  placeholder?: string
  selectOptions?: DataCellSelectOption[]
  dateTimeZone?: DataCellDateTimeZone
  showPickerIcon?: boolean
  activationSource?: DataCellActivationSource
  open?: boolean
  formatValue?: (
    value: Value | undefined,
    meta: { kind: Kind }
  ) => React.ReactNode
  draftValue?: string
  autoFocus?: boolean
  onDraftValueChange?: (value: string, meta: DataCellValueMeta) => void
  onEditingEnd?: () => void
  onActiveChange?: (active: boolean) => void
  onOpenChange?: (open: boolean) => void
  onEditorHandleChange?: (handle: DataCellEditorHandle | null) => void
}

export type DataCellProps =
  | (DataCellBaseProps<"number" | "integer", number | string | null> & {
      onCommit?: (value: number | null, meta: DataCellValueMeta) => void
    })
  | (DataCellBaseProps<"boolean", boolean | null> & {
      onCommit?: (value: boolean, meta: DataCellValueMeta) => void
    })
  | (DataCellBaseProps<"select", string | null> & {
      selectOptions: DataCellSelectOption[]
      onCommit?: (value: string | null, meta: DataCellValueMeta) => void
    })
  | (DataCellBaseProps<
      "text" | "date" | "time" | "date-time",
      string | null
    > & {
      onCommit?: (value: string | null, meta: DataCellValueMeta) => void
    })
