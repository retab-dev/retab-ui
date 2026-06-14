import type * as React from "react"

import type { DataCellBooleanControlProps } from "@/registry/new-york-v4/ui/data-cell-boolean-control"
import type { DataCellControlState } from "@/registry/new-york-v4/ui/data-cell-control-state"
import type { DataCellEditModelByKind } from "@/registry/new-york-v4/ui/data-cell-edit-model"
import type { DataCellPickerControlProps } from "@/registry/new-york-v4/ui/data-cell-picker-control"
import type { DataCellSelectControlProps } from "@/registry/new-york-v4/ui/data-cell-select-control"
import type {
  DataCellNumberControlProps,
  DataCellTextControlProps,
} from "@/registry/new-york-v4/ui/data-cell-text-control"
import type {
  DataCellActivationSource,
  DataCellKind,
} from "@/registry/new-york-v4/ui/data-cell-types"

export type { DataCellControlState }

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
