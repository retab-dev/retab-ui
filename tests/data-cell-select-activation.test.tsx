// @vitest-environment jsdom

import { renderHook } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { createDataCellShellActivationSource } from "@/registry/new-york-v4/ui/data-cell-activation"
import { useDataCellSelectActivation } from "@/registry/new-york-v4/ui/data-cell-select-activation"

describe("DataCell select activation", () => {
  it("opens on autofocus", () => {
    const trigger = document.createElement("button")
    const openEditor = vi.fn()
    const closeEditor = vi.fn()

    renderHook(() =>
      useDataCellSelectActivation({
        autoFocus: true,
        triggerRef: { current: trigger },
        openEditor,
        closeEditor,
        keepOpen: vi.fn(),
      })
    )

    expect(openEditor).toHaveBeenCalledTimes(1)
  })

  it("keeps the popup open during the activation event tail", () => {
    const event = new MouseEvent("pointerdown", { clientX: 10, clientY: 12 })
    const keepOpen = vi.fn()
    const { result } = renderHook(() =>
      useDataCellSelectActivation({
        activationSource: createDataCellShellActivationSource(event),
        autoFocus: true,
        triggerRef: { current: document.createElement("button") },
        openEditor: vi.fn(),
        closeEditor: vi.fn(),
        keepOpen,
      })
    )

    expect(result.current.shouldCancelDismiss("trigger-press", event)).toBe(
      true
    )
    expect(keepOpen).toHaveBeenCalledTimes(1)
  })
})
