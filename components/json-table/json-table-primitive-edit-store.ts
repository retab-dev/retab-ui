import * as React from "react"

import { getValueAtPath } from "@/components/json-table/lib/document-paths"

export type JsonTablePrimitiveEditSnapshot =
  | {
      status: "idle"
      hasValue: false
      value: undefined
    }
  | {
      status: "pending" | "confirmed"
      hasValue: true
      value: unknown
    }
  | {
      status: "stale"
      hasValue: false
      value: undefined
      documentValue: unknown
      previousValue: unknown
    }

type PrimitiveEditEntry = {
  snapshot: JsonTablePrimitiveEditSnapshot
  baseValue: unknown
  supersededValues: unknown[]
  version: number
  listeners: Set<() => void>
}

export type JsonTablePrimitiveEditReconciliation = {
  isPrimitiveDocumentEcho: boolean
  confirmedFieldPaths: string[]
  staleFieldPaths: string[]
}

const idlePrimitiveEditSnapshot: JsonTablePrimitiveEditSnapshot = {
  status: "idle",
  hasValue: false,
  value: undefined,
}

const unresolvedPrimitiveEditBaseValue = Symbol(
  "unresolvedPrimitiveEditBaseValue"
)

const primitiveDocumentEchoes = new WeakSet<Record<string, unknown>>()
const primitiveDocumentEchoKeys = new Set<string>()

export type JsonTablePrimitiveEditStore = ReturnType<
  typeof createJsonTablePrimitiveEditStore
>

export function createJsonTablePrimitiveEditStore() {
  const entries = new Map<string, PrimitiveEditEntry>()

  function entryForPath(fieldPath: string) {
    let entry = entries.get(fieldPath)
    if (!entry) {
      entry = {
        snapshot: idlePrimitiveEditSnapshot,
        baseValue: unresolvedPrimitiveEditBaseValue,
        supersededValues: [],
        version: 0,
        listeners: new Set(),
      }
      entries.set(fieldPath, entry)
    }
    return entry
  }

  function notify(entry: PrimitiveEditEntry) {
    entry.version += 1
    for (const listener of entry.listeners) listener()
  }

  function clearEntry(entry: PrimitiveEditEntry) {
    entry.snapshot = idlePrimitiveEditSnapshot
    entry.baseValue = unresolvedPrimitiveEditBaseValue
    entry.supersededValues = []
  }

  function hasSupersededValue(entry: PrimitiveEditEntry, value: unknown) {
    return entry.supersededValues.some((item) => Object.is(item, value))
  }

  function documentEchoKey(data: Record<string, unknown>) {
    try {
      return JSON.stringify(data)
    } catch {
      return undefined
    }
  }

  return {
    getSnapshot(fieldPath: string | undefined): JsonTablePrimitiveEditSnapshot {
      if (!fieldPath) return idlePrimitiveEditSnapshot
      return entries.get(fieldPath)?.snapshot ?? idlePrimitiveEditSnapshot
    },
    getVersion(fieldPath: string | undefined) {
      if (!fieldPath) return 0
      return entries.get(fieldPath)?.version ?? 0
    },
    commitValue(fieldPath: string, value: unknown, baseValue?: unknown) {
      const entry = entryForPath(fieldPath)
      if (entry.snapshot.hasValue && Object.is(entry.snapshot.value, value)) {
        return
      }

      if (entry.snapshot.status === "pending") {
        entry.supersededValues.push(entry.snapshot.value)
      } else {
        entry.baseValue = baseValue ?? unresolvedPrimitiveEditBaseValue
        entry.supersededValues = []
      }

      entry.snapshot = { status: "pending", hasValue: true, value }
      notify(entry)
    },
    recordDocumentEcho(data: Record<string, unknown>) {
      primitiveDocumentEchoes.add(data)
      const key = documentEchoKey(data)
      if (key !== undefined) primitiveDocumentEchoKeys.add(key)
    },
    reconcileDocumentData(
      data: Record<string, unknown>
    ): JsonTablePrimitiveEditReconciliation {
      const dataEchoKey = documentEchoKey(data)
      const isRecordedPrimitiveEcho =
        primitiveDocumentEchoes.has(data) ||
        (dataEchoKey !== undefined && primitiveDocumentEchoKeys.has(dataEchoKey))
      if (dataEchoKey !== undefined) primitiveDocumentEchoKeys.delete(dataEchoKey)

      const reconciliation: JsonTablePrimitiveEditReconciliation = {
        isPrimitiveDocumentEcho: isRecordedPrimitiveEcho,
        confirmedFieldPaths: [],
        staleFieldPaths: [],
      }

      for (const [fieldPath, entry] of entries) {
        if (entry.snapshot.status !== "pending") continue

        const documentValue = getValueAtPath(data, fieldPath)
        if (Object.is(documentValue, entry.snapshot.value)) {
          entry.snapshot = {
            status: "confirmed",
            hasValue: true,
            value: entry.snapshot.value,
          }
          entry.supersededValues = []
          reconciliation.confirmedFieldPaths.push(fieldPath)
          notify(entry)
          continue
        }

        if (hasSupersededValue(entry, documentValue)) {
          entry.supersededValues = entry.supersededValues.filter(
            (item) => !Object.is(item, documentValue)
          )
          continue
        }

        const hasAuthoritativeChange =
          entry.baseValue !== unresolvedPrimitiveEditBaseValue &&
          !Object.is(documentValue, entry.baseValue)
        if (!hasAuthoritativeChange) continue

        const previousValue = entry.snapshot.value
        entry.snapshot = {
          status: "stale",
          hasValue: false,
          value: undefined,
          documentValue,
          previousValue,
        }
        entry.baseValue = unresolvedPrimitiveEditBaseValue
        entry.supersededValues = []
        reconciliation.staleFieldPaths.push(fieldPath)
        notify(entry)
      }

      return reconciliation
    },
    reconcileProjectedValue(fieldPath: string | undefined, value: unknown) {
      if (!fieldPath) return
      const entry = entries.get(fieldPath)
      if (!entry) return

      const shouldClear =
        (entry.snapshot.status === "confirmed" &&
          Object.is(entry.snapshot.value, value)) ||
        entry.snapshot.status === "stale"
      if (!shouldClear) return

      clearEntry(entry)
      notify(entry)
    },
    reset() {
      for (const entry of entries.values()) {
        clearEntry(entry)
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

export function useJsonTablePrimitiveEditSnapshot({
  fieldPath,
  store,
}: {
  fieldPath: string | undefined
  store: JsonTablePrimitiveEditStore
}) {
  React.useSyncExternalStore(
    React.useCallback(
      (listener) => store.subscribe(fieldPath, listener),
      [fieldPath, store]
    ),
    React.useCallback(() => store.getVersion(fieldPath), [fieldPath, store]),
    () => 0
  )

  return store.getSnapshot(fieldPath)
}
