import * as React from "react"

import { getValueAtPath } from "@/components/json-table/lib/document-paths"

export type JsonTablePrimitivePatchSnapshot =
  | {
      hasValue: false
      value: undefined
    }
  | {
      hasValue: true
      value: unknown
    }

type PrimitivePatchEntry = {
  snapshot: JsonTablePrimitivePatchSnapshot
  baseValue: unknown
  version: number
  listeners: Set<() => void>
}

const emptyPrimitivePatchSnapshot: JsonTablePrimitivePatchSnapshot = {
  hasValue: false,
  value: undefined,
}
const unresolvedPrimitivePatchBaseValue = Symbol(
  "unresolvedPrimitivePatchBaseValue"
)

const scalarDocumentUpdates = new WeakSet<Record<string, unknown>>()

export type JsonTablePrimitivePatchStore = ReturnType<
  typeof createJsonTablePrimitivePatchStore
>

export const fallbackJsonTablePrimitivePatchStore =
  createJsonTablePrimitivePatchStore()

export function createJsonTablePrimitivePatchStore() {
  const entries = new Map<string, PrimitivePatchEntry>()

  function entryForPath(fieldPath: string) {
    let entry = entries.get(fieldPath)
    if (!entry) {
      entry = {
        snapshot: emptyPrimitivePatchSnapshot,
        baseValue: unresolvedPrimitivePatchBaseValue,
        version: 0,
        listeners: new Set(),
      }
      entries.set(fieldPath, entry)
    }
    return entry
  }

  function notify(entry: PrimitivePatchEntry) {
    entry.version += 1
    for (const listener of entry.listeners) listener()
  }

  return {
    getSnapshot(fieldPath: string | undefined): JsonTablePrimitivePatchSnapshot {
      if (!fieldPath) return emptyPrimitivePatchSnapshot
      return entries.get(fieldPath)?.snapshot ?? emptyPrimitivePatchSnapshot
    },
    getVersion(fieldPath: string | undefined) {
      if (!fieldPath) return 0
      return entries.get(fieldPath)?.version ?? 0
    },
    setValue(fieldPath: string, value: unknown, baseValue?: unknown) {
      const entry = entryForPath(fieldPath)
      if (entry.snapshot.hasValue && Object.is(entry.snapshot.value, value)) {
        return
      }
      entry.baseValue = entry.snapshot.hasValue
        ? entry.baseValue
        : (baseValue ?? unresolvedPrimitivePatchBaseValue)
      entry.snapshot = { hasValue: true, value }
      notify(entry)
    },
    reconcileDocumentData(data: Record<string, unknown>) {
      for (const [fieldPath, entry] of entries) {
        if (!entry.snapshot.hasValue) continue
        const documentValue = getValueAtPath(data, fieldPath)
        const hasCaughtUp = Object.is(documentValue, entry.snapshot.value)
        const hasAuthoritativeChange =
          entry.baseValue !== unresolvedPrimitivePatchBaseValue &&
          !Object.is(documentValue, entry.baseValue)
        if (!hasCaughtUp && !hasAuthoritativeChange) {
          continue
        }
        entry.snapshot = emptyPrimitivePatchSnapshot
        entry.baseValue = unresolvedPrimitivePatchBaseValue
        notify(entry)
      }
    },
    subscribe(fieldPath: string | undefined, listener: () => void) {
      if (!fieldPath) return () => {}
      const entry = entryForPath(fieldPath)
      entry.listeners.add(listener)
      return () => {
        entry.listeners.delete(listener)
      }
    },
  }
}

export function useJsonTablePrimitivePatchSnapshot({
  fieldPath,
  store,
}: {
  fieldPath: string | undefined
  store: JsonTablePrimitivePatchStore | undefined
}) {
  const patchStore = store ?? fallbackJsonTablePrimitivePatchStore

  React.useSyncExternalStore(
    React.useCallback(
      (listener) => patchStore.subscribe(fieldPath, listener),
      [fieldPath, patchStore]
    ),
    React.useCallback(
      () => patchStore.getVersion(fieldPath),
      [fieldPath, patchStore]
    ),
    () => 0
  )

  return patchStore.getSnapshot(fieldPath)
}

export function registerJsonTableScalarDocumentData(
  data: Record<string, unknown>
) {
  scalarDocumentUpdates.add(data)
}

export function isRegisteredJsonTableScalarDocumentData(
  data: unknown
): data is Record<string, unknown> {
  return (
    typeof data === "object" &&
    data !== null &&
    scalarDocumentUpdates.has(data as Record<string, unknown>)
  )
}
