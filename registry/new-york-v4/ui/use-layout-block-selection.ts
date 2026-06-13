"use client"

import * as React from "react"

import type { LayoutBlockSelection } from "./layout-blocks-types"

export function useLayoutBlockSelection({
  activeItemId: controlledActiveItemId,
  selectedItemId: controlledSelectedItemId,
  onActiveItemIdChange,
  onSelectedItemIdChange,
}: {
  activeItemId?: string | null
  selectedItemId?: string | null
  onActiveItemIdChange?: (itemId: string | null) => void
  onSelectedItemIdChange?: (itemId: string | null) => void
} = {}): LayoutBlockSelection {
  const [uncontrolledActiveItemId, setUncontrolledActiveItemId] =
    React.useState<string | null>(null)
  const [uncontrolledSelectedItemId, setUncontrolledSelectedItemId] =
    React.useState<string | null>(null)

  const activeItemId = controlledActiveItemId ?? uncontrolledActiveItemId
  const selectedItemId = controlledSelectedItemId ?? uncontrolledSelectedItemId
  const effectiveItemId = activeItemId ?? selectedItemId

  const setActiveItemId = React.useCallback(
    (itemId: string | null) => {
      if (controlledActiveItemId === undefined) {
        setUncontrolledActiveItemId(itemId)
      }
      onActiveItemIdChange?.(itemId)
    },
    [controlledActiveItemId, onActiveItemIdChange]
  )

  const selectItemId = React.useCallback(
    (itemId: string | null) => {
      if (controlledSelectedItemId === undefined) {
        setUncontrolledSelectedItemId(itemId)
      }
      onSelectedItemIdChange?.(itemId)
    },
    [controlledSelectedItemId, onSelectedItemIdChange]
  )

  const clearActiveItemId = React.useCallback(() => {
    setActiveItemId(null)
  }, [setActiveItemId])

  const clearSelectedItemId = React.useCallback(() => {
    selectItemId(null)
  }, [selectItemId])

  const clear = React.useCallback(() => {
    setActiveItemId(null)
    selectItemId(null)
  }, [selectItemId, setActiveItemId])

  return {
    activeItemId,
    selectedItemId,
    effectiveItemId,
    setActiveItemId,
    selectItemId,
    clearActiveItemId,
    clearSelectedItemId,
    clear,
  }
}
