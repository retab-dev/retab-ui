import type * as React from "react"

import {
  canActivateDataCellFromKey,
  createDataCellKeyboardActivationSource,
  createDataCellShellActivationSource,
  type DataCellActivationSource,
} from "@/components/ui/data-cell"
import type { DataCellKind } from "@/components/ui/data-cell"
import type { JsonTableActivationIntent } from "@/components/json-table/json-table-edit-session"

const dataCellEventTargetSelector =
  '[data-slot="data-cell"], [data-slot="input-control"]'

export function isJsonTableDataCellEventTarget(target: EventTarget | null) {
  return (
    target instanceof Element &&
    Boolean(target.closest(dataCellEventTargetSelector))
  )
}

export function shellActivationSource(event?: Event): DataCellActivationSource {
  return createDataCellShellActivationSource(event)
}

export function structuredPointerActivationIntent(
  event: React.PointerEvent<HTMLElement>
): JsonTableActivationIntent {
  return {
    type: "pointer",
    clientX: event.clientX,
    clientY: event.clientY,
    detail: event.detail,
  }
}

function isAltGraphKey(event: React.KeyboardEvent<HTMLElement>): boolean {
  return (
    event.getModifierState("AltGraph") ||
    event.nativeEvent.getModifierState?.("AltGraph") ||
    (event.ctrlKey &&
      event.altKey &&
      event.key.length === 1 &&
      !/^[\x00-\x7F]$/.test(event.key))
  )
}

function isPlatformOrComposingKey(event: React.KeyboardEvent<HTMLElement>) {
  const isAltGraph = isAltGraphKey(event)
  return (
    event.defaultPrevented ||
    event.metaKey ||
    (event.ctrlKey && !isAltGraph) ||
    (event.altKey && !isAltGraph) ||
    event.nativeEvent.isComposing
  )
}

export function canActivatePrimitiveFromShellKey({
  dataCellKind,
  event,
}: {
  dataCellKind: DataCellKind | null
  event: React.KeyboardEvent<HTMLElement>
}) {
  return (
    !isPlatformOrComposingKey(event) &&
    Boolean(dataCellKind) &&
    canActivateDataCellFromKey(dataCellKind as DataCellKind, event.key)
  )
}

export function keyboardActivationSource(
  event: React.KeyboardEvent<HTMLElement>
): DataCellActivationSource {
  return createDataCellKeyboardActivationSource(event.key)
}

export function canActivateStructuredFromShellKey(
  event: React.KeyboardEvent<HTMLElement>
) {
  return (
    !isPlatformOrComposingKey(event) &&
    (event.key === "Enter" || event.key === "F2" || event.key === " ")
  )
}

export function structuredKeyboardActivationIntent(
  event: React.KeyboardEvent<HTMLElement>
): JsonTableActivationIntent {
  return {
    type: "keyboard",
    key: event.key,
  }
}

export function armShellActivationGuard(
  shellActivationGuardRef: React.MutableRefObject<boolean>
) {
  shellActivationGuardRef.current = true
}

export function consumeShellActivationGuard(
  shellActivationGuardRef: React.MutableRefObject<boolean>
) {
  if (!shellActivationGuardRef.current) return false
  shellActivationGuardRef.current = false
  return true
}
