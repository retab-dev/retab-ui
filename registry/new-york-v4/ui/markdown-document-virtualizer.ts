export interface MarkdownVirtualItem {
  bottom: number
  height: number
  index: number
  key: string
  top: number
}

export interface MarkdownScrollAnchor {
  index: number
  offsetWithinItem: number
}

export function getMarkdownVirtualItems({
  count,
  estimateHeight,
  getKey,
  measuredHeights,
  overscanPx,
  scrollTop,
  viewportHeight,
}: {
  count: number
  estimateHeight: (index: number) => number
  getKey: (index: number) => string
  measuredHeights: ReadonlyMap<string, number>
  overscanPx: number
  scrollTop: number
  viewportHeight: number
}): {
  items: MarkdownVirtualItem[]
  totalHeight: number
} {
  const items: MarkdownVirtualItem[] = []
  const viewportTop = Math.max(0, scrollTop - overscanPx)
  const viewportBottom = scrollTop + viewportHeight + overscanPx
  let totalHeight = 0

  for (let index = 0; index < count; index++) {
    const key = getKey(index)
    const height = Math.max(1, measuredHeights.get(key) ?? estimateHeight(index))
    const top = totalHeight
    const bottom = top + height
    totalHeight = bottom

    if (bottom >= viewportTop && top <= viewportBottom) {
      items.push({ bottom, height, index, key, top })
    }
  }

  return { items, totalHeight }
}

export function getMarkdownScrollAnchor({
  count,
  estimateHeight,
  getKey,
  measuredHeights,
  scrollTop,
}: {
  count: number
  estimateHeight: (index: number) => number
  getKey: (index: number) => string
  measuredHeights: ReadonlyMap<string, number>
  scrollTop: number
}): MarkdownScrollAnchor | null {
  let top = 0

  for (let index = 0; index < count; index++) {
    const key = getKey(index)
    const height = Math.max(1, measuredHeights.get(key) ?? estimateHeight(index))
    const bottom = top + height
    if (bottom >= scrollTop) {
      return {
        index,
        offsetWithinItem: Math.max(0, scrollTop - top),
      }
    }
    top = bottom
  }

  return count > 0 ? { index: count - 1, offsetWithinItem: 0 } : null
}

export function scrollTopForMarkdownAnchor({
  anchor,
  count,
  estimateHeight,
  getKey,
  measuredHeights,
}: {
  anchor: MarkdownScrollAnchor
  count: number
  estimateHeight: (index: number) => number
  getKey: (index: number) => string
  measuredHeights: ReadonlyMap<string, number>
}) {
  let top = 0
  const targetIndex = Math.min(Math.max(0, anchor.index), count - 1)

  for (let index = 0; index < targetIndex; index++) {
    const key = getKey(index)
    top += Math.max(1, measuredHeights.get(key) ?? estimateHeight(index))
  }

  const targetKey = getKey(targetIndex)
  const targetHeight = Math.max(
    1,
    measuredHeights.get(targetKey) ?? estimateHeight(targetIndex)
  )
  return Math.max(
    0,
    top + Math.min(anchor.offsetWithinItem, Math.max(0, targetHeight - 1))
  )
}

export function topForMarkdownIndex({
  count,
  estimateHeight,
  getKey,
  index,
  measuredHeights,
}: {
  count: number
  estimateHeight: (index: number) => number
  getKey: (index: number) => string
  index: number
  measuredHeights: ReadonlyMap<string, number>
}) {
  let top = 0
  const targetIndex = Math.min(Math.max(0, index), count - 1)

  for (let currentIndex = 0; currentIndex < targetIndex; currentIndex++) {
    const key = getKey(currentIndex)
    top += Math.max(1, measuredHeights.get(key) ?? estimateHeight(currentIndex))
  }

  return top
}
