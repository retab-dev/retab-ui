import * as React from "react"

import type { PdfPageRenderTiming } from "./pdf-viewer-types"

export const PDF_PAGE_RENDER_CONCURRENCY = 2

type PdfPageRenderKeyInput = {
  pageNumber: number
  scale: number
  rotation: number
  devicePixelRatio: number
}

export function getPdfPageRenderKey({
  pageNumber,
  scale,
  rotation,
  devicePixelRatio,
}: PdfPageRenderKeyInput) {
  return `${pageNumber}:${scale}:${rotation}:${devicePixelRatio}`
}

export function usePdfPageRenderScheduler({
  pageNumbers,
  scale,
  rotation,
  devicePixelRatio,
  resetKey,
  maxRunning = PDF_PAGE_RENDER_CONCURRENCY,
}: {
  pageNumbers: readonly number[]
  scale: number
  rotation: number
  devicePixelRatio: number
  resetKey: unknown
  maxRunning?: number
}) {
  const requestedRenderKeys = React.useMemo(
    () =>
      pageNumbers.map((pageNumber) =>
        getPdfPageRenderKey({
          pageNumber,
          scale,
          rotation,
          devicePixelRatio,
        })
      ),
    [devicePixelRatio, pageNumbers, rotation, scale]
  )
  const requestedRenderKeySet = React.useMemo(
    () => new Set(requestedRenderKeys),
    [requestedRenderKeys]
  )
  const requestedRenderKeySetRef = React.useRef(requestedRenderKeySet)
  const resetKeyRef = React.useRef(resetKey)
  React.useLayoutEffect(() => {
    requestedRenderKeySetRef.current = requestedRenderKeySet
    resetKeyRef.current = resetKey
  }, [requestedRenderKeySet, resetKey])

  const [state, setState] = React.useState<{
    resetKey: unknown
    renderedKeys: ReadonlySet<string>
  }>(() => ({ resetKey, renderedKeys: new Set() }))
  const renderedKeys = Object.is(state.resetKey, resetKey)
    ? state.renderedKeys
    : new Set<string>()

  React.useEffect(() => {
    setState((previousState) => {
      if (!Object.is(previousState.resetKey, resetKey)) {
        return { resetKey, renderedKeys: new Set() }
      }

      const renderedKeys = new Set<string>()
      for (const key of previousState.renderedKeys) {
        if (requestedRenderKeySet.has(key)) renderedKeys.add(key)
      }

      return areSetsEqual(previousState.renderedKeys, renderedKeys)
        ? previousState
        : { resetKey, renderedKeys }
    })
  }, [requestedRenderKeySet, resetKey])

  const activePageNumbers = React.useMemo(() => {
    const renderedPageNumbers: number[] = []
    const pendingPageNumbers: number[] = []

    for (const [index, pageNumber] of pageNumbers.entries()) {
      const key = requestedRenderKeys[index]
      if (renderedKeys.has(key)) {
        renderedPageNumbers.push(pageNumber)
      } else {
        pendingPageNumbers.push(pageNumber)
      }
    }

    return [
      ...renderedPageNumbers,
      ...pendingPageNumbers.slice(0, Math.max(1, maxRunning)),
    ].sort((left, right) => left - right)
  }, [maxRunning, pageNumbers, renderedKeys, requestedRenderKeys])

  const onPageRenderTiming = React.useCallback(
    (timing: PdfPageRenderTiming) => {
      const key = getPdfPageRenderKey(timing)

      setState((previousState) => {
        const resetKey = resetKeyRef.current
        const previousRenderedKeys = Object.is(previousState.resetKey, resetKey)
          ? previousState.renderedKeys
          : new Set<string>()
        const nextRenderedKeys = new Set(previousRenderedKeys)

        if (
          timing.status === "rendered" &&
          requestedRenderKeySetRef.current.has(key)
        ) {
          nextRenderedKeys.add(key)
        } else {
          nextRenderedKeys.delete(key)
        }

        return areSetsEqual(previousRenderedKeys, nextRenderedKeys)
          ? previousState
          : { resetKey, renderedKeys: nextRenderedKeys }
      })
    },
    []
  )

  return { activePageNumbers, onPageRenderTiming }
}

function areSetsEqual(left: ReadonlySet<string>, right: ReadonlySet<string>) {
  if (left.size !== right.size) return false
  for (const value of left) {
    if (!right.has(value)) return false
  }
  return true
}
