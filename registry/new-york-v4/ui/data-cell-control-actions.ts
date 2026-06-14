import {
  createDataCellKeyboardActivationSource,
  createDataCellPointerActivationSource,
} from "@/registry/new-york-v4/ui/data-cell-activation"
import { commitDataCellBooleanToggle } from "@/registry/new-york-v4/ui/data-cell-boolean-value"
import {
  commandDataCellControlAction,
  editDataCellControlAction,
  noneDataCellControlAction,
  type DataCellControlAction,
  type DataCellControlKeyActionArgs,
  type DataCellControlPointerActionArgs,
} from "@/registry/new-york-v4/ui/data-cell-control-contract"
import { getDataCellTextPointerActivationSource } from "@/registry/new-york-v4/ui/data-cell-text-activation"
import type { DataCellKind } from "@/registry/new-york-v4/ui/data-cell-types"

const dataCellOpenKeys = new Set(["Enter", "F2", " "])
const dataCellNumberKeyPattern = /^[0-9.+-]$/

export function getDataCellPointerControlAction(
  args: DataCellControlPointerActionArgs
): DataCellControlAction {
  const { controlState } = args
  if (controlState.kind === "text") {
    return editDataCellControlAction(
      getDataCellTextPointerActivationSource({
        clientX: args.clientX,
        clientY: args.clientY,
        detail: args.detail,
        displayElement: args.displayElement,
        event: args.event,
        value: controlState.value,
      }),
      { shouldPreventDefault: true }
    )
  }
  if (controlState.kind === "boolean") {
    return commandDataCellControlAction(
      () =>
        commitDataCellBooleanToggle(controlState.value, controlState.onCommit),
      { shouldPreventDefault: true }
    )
  }
  if (controlState.kind === "select") {
    return noneDataCellControlAction()
  }
  return createDefaultPointerEditAction(args)
}

export function getDataCellClickControlAction(
  args: DataCellControlPointerActionArgs
): DataCellControlAction {
  const { controlState } = args
  if (controlState.kind === "text") {
    return editDataCellControlAction(
      getDataCellTextPointerActivationSource({
        clientX: args.clientX,
        clientY: args.clientY,
        detail: args.detail,
        displayElement: args.displayElement,
        event: args.event,
        value: controlState.value,
      }),
      { shouldPreventDefault: false }
    )
  }
  if (controlState.kind === "boolean") {
    return commandDataCellControlAction(
      () =>
        commitDataCellBooleanToggle(controlState.value, controlState.onCommit),
      { shouldPreventDefault: false }
    )
  }
  return createDefaultClickEditAction(args)
}

export function getDataCellKeyControlAction(
  args: DataCellControlKeyActionArgs
): DataCellControlAction {
  if (!canActivateDataCellControlFromKey(args.controlState.kind, args.key)) {
    return noneDataCellControlAction()
  }

  if (args.controlState.kind === "boolean" && args.key === " ") {
    const booleanState = args.controlState
    return commandDataCellControlAction(
      () =>
        commitDataCellBooleanToggle(
          booleanState.value,
          booleanState.onCommit
        ),
      { shouldPreventDefault: true }
    )
  }

  return editDataCellControlAction(
    createDataCellKeyboardActivationSource(args.key),
    { shouldPreventDefault: true }
  )
}

function canActivateDataCellControlFromKey(kind: DataCellKind, key: string) {
  if (kind === "text") {
    return key === "Enter" || key === "F2" || key.length === 1
  }
  if (kind === "number" || kind === "integer") {
    return canActivateDataCellNumberFromKey(kind, key)
  }
  if (kind === "boolean") return key === "Enter" || key === "F2" || key === " "
  return dataCellOpenKeys.has(key)
}

function canActivateDataCellNumberFromKey(
  kind: "number" | "integer",
  key: string
) {
  if (key === "Enter" || key === "F2") return true
  if (key.length !== 1) return false
  if (kind === "integer") return /^[+-]$|^\d$/.test(key)
  return dataCellNumberKeyPattern.test(key)
}

function createDefaultPointerEditAction<Kind extends DataCellKind>({
  clientX,
  clientY,
  detail,
  event,
}: DataCellControlPointerActionArgs<Kind>): DataCellControlAction {
  return editDataCellControlAction(
    createDataCellPointerActivationSource({ clientX, clientY, detail, event }),
    { shouldPreventDefault: true }
  )
}

function createDefaultClickEditAction<Kind extends DataCellKind>({
  clientX,
  clientY,
  detail,
  event,
}: DataCellControlPointerActionArgs<Kind>): DataCellControlAction {
  return editDataCellControlAction(
    createDataCellPointerActivationSource({ clientX, clientY, detail, event }),
    { shouldPreventDefault: false }
  )
}
