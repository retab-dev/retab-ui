import { describe, expect, it, vi } from "vitest"

import { createJsonTablePrimitiveEditStore } from "@/components/json-table/json-table-primitive-edit-store"

describe("json table primitive edit store", () => {
  it("starts idle and keeps same-value commits quiet", () => {
    const store = createJsonTablePrimitiveEditStore()
    const listener = vi.fn()
    store.subscribe("vendor", listener)

    store.commitValue("vendor", "Acme", "Acme")
    store.commitValue("vendor", "Acme", "Acme")

    expect(listener).toHaveBeenCalledTimes(1)
    expect(store.getSnapshot("vendor")).toEqual({
      status: "pending",
      hasValue: true,
      value: "Acme",
    })
  })

  it("keeps rapid repeated commits pending until the latest echo arrives", () => {
    const store = createJsonTablePrimitiveEditStore()
    const firstEcho = { vendor: "Globex" }
    const secondEcho = { vendor: "Initech" }

    store.commitValue("vendor", "Globex", "Acme")
    store.commitValue("vendor", "Initech", "Acme")
    store.recordDocumentEcho(firstEcho)

    expect(store.reconcileDocumentData(firstEcho)).toEqual({
      isPrimitiveDocumentEcho: true,
      confirmedFieldPaths: [],
      staleFieldPaths: [],
    })
    expect(store.getSnapshot("vendor")).toEqual({
      status: "pending",
      hasValue: true,
      value: "Initech",
    })

    store.recordDocumentEcho(secondEcho)
    expect(store.reconcileDocumentData(secondEcho)).toEqual({
      isPrimitiveDocumentEcho: true,
      confirmedFieldPaths: ["vendor"],
      staleFieldPaths: [],
    })
    expect(store.getSnapshot("vendor")).toEqual({
      status: "confirmed",
      hasValue: true,
      value: "Initech",
    })
  })

  it("recognizes cloned parent echoes recorded by this store", () => {
    const store = createJsonTablePrimitiveEditStore()
    const recordedEcho = { vendor: "Globex", total: 12 }
    const clonedEcho = { ...recordedEcho }

    store.commitValue("vendor", "Globex", "Acme")
    store.recordDocumentEcho(recordedEcho)

    expect(store.reconcileDocumentData(clonedEcho)).toEqual({
      isPrimitiveDocumentEcho: true,
      confirmedFieldPaths: ["vendor"],
      staleFieldPaths: [],
    })
    expect(store.getSnapshot("vendor")).toEqual({
      status: "confirmed",
      hasValue: true,
      value: "Globex",
    })
  })

  it("keeps cloned echo recognition isolated between stores", () => {
    const firstStore = createJsonTablePrimitiveEditStore()
    const secondStore = createJsonTablePrimitiveEditStore()
    const recordedEcho = { vendor: "Globex" }
    const clonedEcho = { ...recordedEcho }

    firstStore.commitValue("vendor", "Globex", "Acme")
    firstStore.recordDocumentEcho(recordedEcho)
    secondStore.commitValue("vendor", "Globex", "Acme")

    expect(secondStore.reconcileDocumentData(clonedEcho)).toEqual({
      isPrimitiveDocumentEcho: false,
      confirmedFieldPaths: ["vendor"],
      staleFieldPaths: [],
    })
    expect(firstStore.reconcileDocumentData(clonedEcho)).toEqual({
      isPrimitiveDocumentEcho: true,
      confirmedFieldPaths: ["vendor"],
      staleFieldPaths: [],
    })
  })

  it("clears confirmed edits when projected data catches up", () => {
    const store = createJsonTablePrimitiveEditStore()
    const echo = { vendor: "Globex" }

    store.commitValue("vendor", "Globex", "Acme")
    store.recordDocumentEcho(echo)
    store.reconcileDocumentData(echo)
    store.reconcileProjectedValue("vendor", "Globex")

    expect(store.getSnapshot("vendor")).toEqual({
      status: "idle",
      hasValue: false,
      value: undefined,
    })
  })

  it("marks mismatched authoritative echoes stale", () => {
    const store = createJsonTablePrimitiveEditStore()

    store.commitValue("vendor", "Globex", "Acme")
    expect(store.reconcileDocumentData({ vendor: "Server" })).toEqual({
      isPrimitiveDocumentEcho: false,
      confirmedFieldPaths: [],
      staleFieldPaths: ["vendor"],
    })
    expect(store.getSnapshot("vendor")).toEqual({
      status: "stale",
      hasValue: false,
      value: undefined,
      documentValue: "Server",
      previousValue: "Globex",
    })
  })

  it("notifies only subscribers for the edited path", () => {
    const store = createJsonTablePrimitiveEditStore()
    const vendorListener = vi.fn()
    const totalListener = vi.fn()
    store.subscribe("vendor", vendorListener)
    store.subscribe("total", totalListener)

    store.commitValue("vendor", "Globex", "Acme")

    expect(vendorListener).toHaveBeenCalledTimes(1)
    expect(totalListener).not.toHaveBeenCalled()
  })

  it("stops notifying unsubscribed listeners", () => {
    const store = createJsonTablePrimitiveEditStore()
    const listener = vi.fn()
    const unsubscribe = store.subscribe("vendor", listener)

    unsubscribe()
    store.commitValue("vendor", "Globex", "Acme")

    expect(listener).not.toHaveBeenCalled()
  })

  it("resets every path on document replacement", () => {
    const store = createJsonTablePrimitiveEditStore()
    const vendorListener = vi.fn()
    const totalListener = vi.fn()
    store.subscribe("vendor", vendorListener)
    store.subscribe("total", totalListener)
    store.commitValue("vendor", "Globex", "Acme")
    store.commitValue("total", 2, 1)

    store.reset()

    expect(store.getSnapshot("vendor").status).toBe("idle")
    expect(store.getSnapshot("total").status).toBe("idle")
    expect(vendorListener).toHaveBeenCalledTimes(2)
    expect(totalListener).toHaveBeenCalledTimes(2)
  })
})
