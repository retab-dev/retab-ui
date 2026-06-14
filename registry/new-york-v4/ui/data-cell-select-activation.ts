"use client"

import * as React from "react"

import {
  useDataCellOpeningContext,
  type DataCellActivationSource,
  type DataCellDismissCause,
} from "@/registry/new-york-v4/ui/data-cell-activation"

export function useDataCellSelectActivation({
  activationSource,
  autoFocus,
  triggerRef,
  openEditor,
  closeEditor,
  keepOpen,
}: {
  activationSource?: DataCellActivationSource
  autoFocus?: boolean
  triggerRef: React.RefObject<HTMLButtonElement | null>
  openEditor: () => void
  closeEditor: () => void
  keepOpen: () => void
}) {
  const openingContext = useDataCellOpeningContext(activationSource, {
    enabled: Boolean(autoFocus),
  })

  const shouldCancelDismiss = React.useCallback(
    (kind: DataCellDismissCause["kind"], event: Event | undefined) => {
      if (
        !openingContext.shouldCancelDismiss(
          dataCellSelectDismissCause(kind, event)
        )
      ) {
        return false
      }

      event?.preventDefault()
      keepOpen()
      return true
    },
    [keepOpen, openingContext]
  )

  const closeActivatedEditor = React.useCallback(() => {
    openingContext.release()
    closeEditor()
  }, [closeEditor, openingContext])

  const openActivatedEditor = React.useCallback(() => {
    openEditor()
  }, [openEditor])

  React.useLayoutEffect(() => {
    if (!autoFocus) return
    triggerRef.current?.focus({ preventScroll: true })
    openActivatedEditor()
  }, [autoFocus, openActivatedEditor, triggerRef])

  return {
    shouldCancelDismiss,
    closeEditor: closeActivatedEditor,
    openEditor: openActivatedEditor,
    release: openingContext.release,
  }
}

function dataCellSelectDismissCause(
  kind: DataCellDismissCause["kind"],
  event: Event | undefined
): DataCellDismissCause {
  if (kind === "outside-pointer" && event instanceof PointerEvent) {
    return { kind, event }
  }
  if (kind === "escape" && event instanceof KeyboardEvent) {
    return { kind, event }
  }
  if (kind === "trigger-press") return { kind, event }
  if (kind === "focus-out") return { kind, event }
  if (kind === "cancel-open") return { kind, event }
  return { kind: "unknown", event }
}
