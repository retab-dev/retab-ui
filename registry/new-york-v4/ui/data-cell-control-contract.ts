import type * as React from "react"

import type {
  DataCellActivationSource,
  DataCellCommitHandler,
  DataCellProps,
} from "@/registry/new-york-v4/ui/data-cell-types"

export type DataCellControlPointerActionArgs = {
  props: DataCellProps
  clientX: number
  clientY: number
  detail: number
  displayElement: HTMLElement | null
  event?: Event
}

export type DataCellControlKeyActionArgs = {
  props: DataCellProps
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
      commit: (onCommit: DataCellCommitHandler | undefined) => void
      shouldPreventDefault: boolean
    }

export type DataCellControlAdapter = {
  Control: React.ComponentType<DataCellProps>
  activatePointer: (
    args: DataCellControlPointerActionArgs
  ) => DataCellControlAction
  activateClick: (
    args: DataCellControlPointerActionArgs
  ) => DataCellControlAction
  activateKey: (args: DataCellControlKeyActionArgs) => DataCellControlAction
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
  commit: (onCommit: DataCellCommitHandler | undefined) => void,
  { shouldPreventDefault }: { shouldPreventDefault: boolean }
): DataCellControlAction {
  return {
    kind: "command",
    commit,
    shouldPreventDefault,
  }
}
