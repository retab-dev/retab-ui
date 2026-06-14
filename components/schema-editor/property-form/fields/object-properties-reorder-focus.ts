"use client"

import * as React from "react"

import type { ObjectPropertyRowModel } from "@/components/schema-editor/property-form/model/object-properties-view"

export type ObjectPropertyReorderDirection = "down" | "up"

export interface ObjectPropertyReorderFocusTarget {
  direction: ObjectPropertyReorderDirection
  rowId: string
}

export interface ObjectPropertyReorderFocusController {
  getActionAttributes: (
    target: ObjectPropertyReorderFocusTarget
  ) => React.ButtonHTMLAttributes<HTMLButtonElement> &
    Record<
      "data-schema-row-reorder-direction" | "data-schema-row-reorder-row-id",
      string
    >
  restoreAfterMove: (target: ObjectPropertyReorderFocusTarget) => void
  rootRef: React.RefObject<HTMLDivElement | null>
}

export function useObjectPropertyReorderFocus(
  rows: readonly ObjectPropertyRowModel[]
): ObjectPropertyReorderFocusController {
  const rootRef = React.useRef<HTMLDivElement>(null)
  const pendingFocusTargetRef =
    React.useRef<ObjectPropertyReorderFocusTarget | null>(null)

  React.useLayoutEffect(() => {
    const target = pendingFocusTargetRef.current
    if (!target) return

    const button = Array.from(
      rootRef.current?.querySelectorAll("button") ?? []
    ).find(
      (candidate) =>
        candidate.getAttribute("data-schema-row-reorder-row-id") ===
          target.rowId &&
        candidate.getAttribute("data-schema-row-reorder-direction") ===
          target.direction
    )

    if (button instanceof HTMLButtonElement && !button.disabled) {
      button.focus()
    }
    pendingFocusTargetRef.current = null
  }, [rows])

  return {
    getActionAttributes: ({ direction, rowId }) => ({
      "data-schema-row-reorder-direction": direction,
      "data-schema-row-reorder-row-id": rowId,
    }),
    restoreAfterMove: (target) => {
      pendingFocusTargetRef.current = target
    },
    rootRef,
  }
}
