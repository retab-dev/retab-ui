export interface MarkdownVirtualItem {
  bottom: number
  height: number
  index: number
  key: string
  top: number
}

export interface MarkdownVirtualGeometry {
  count: number
  heights: readonly number[]
  keys: readonly string[]
  offsets: readonly number[]
  totalHeight: number
}

export interface MarkdownScrollAnchor {
  index: number
  offsetWithinItem: number
}

export function createMarkdownVirtualGeometry({
  count,
  estimateHeight,
  getKey,
  measuredHeights,
}: {
  count: number
  estimateHeight: (index: number) => number
  getKey: (index: number) => string
  measuredHeights: ReadonlyMap<string, number>
}): MarkdownVirtualGeometry {
  const heights: number[] = []
  const keys: string[] = []
  const offsets = [0]

  for (let index = 0; index < count; index++) {
    const key = getKey(index)
    const height = resolveMarkdownItemHeight({
      estimateHeight,
      index,
      key,
      measuredHeights,
    })
    keys.push(key)
    heights.push(height)
    offsets.push(offsets[index]! + height)
  }

  return {
    count,
    heights,
    keys,
    offsets,
    totalHeight: offsets[count] ?? 0,
  }
}

export function getMarkdownVirtualItems({
  geometry,
  overscanPx,
  scrollTop,
  viewportHeight,
}: {
  geometry: MarkdownVirtualGeometry
  overscanPx: number
  scrollTop: number
  viewportHeight: number
}): {
  items: MarkdownVirtualItem[]
  totalHeight: number
} {
  if (geometry.count === 0) {
    return { items: [], totalHeight: 0 }
  }

  const items: MarkdownVirtualItem[] = []
  const viewportTop = Math.max(0, scrollTop - overscanPx)
  const viewportBottom = scrollTop + viewportHeight + overscanPx
  const startIndex = findFirstItemWithBottomAtOrAfter(
    geometry.offsets,
    viewportTop
  )
  const endIndex = findFirstItemWithTopAfter(geometry.offsets, viewportBottom)

  for (let index = startIndex; index < endIndex; index++) {
    const top = geometry.offsets[index]!
    const bottom = geometry.offsets[index + 1]!
    items.push({
      bottom,
      height: geometry.heights[index]!,
      index,
      key: geometry.keys[index]!,
      top,
    })
  }

  return { items, totalHeight: geometry.totalHeight }
}

export function getMarkdownScrollAnchor({
  geometry,
  scrollTop,
}: {
  geometry: MarkdownVirtualGeometry
  scrollTop: number
}): MarkdownScrollAnchor | null {
  if (geometry.count === 0) return null

  const index = Math.min(
    findFirstItemWithBottomAtOrAfter(geometry.offsets, scrollTop),
    geometry.count - 1
  )
  return {
    index,
    offsetWithinItem: Math.max(0, scrollTop - geometry.offsets[index]!),
  }
}

export function scrollTopForMarkdownAnchor({
  anchor,
  geometry,
}: {
  anchor: MarkdownScrollAnchor
  geometry: MarkdownVirtualGeometry
}) {
  if (geometry.count === 0) return 0

  const targetIndex = Math.min(Math.max(0, anchor.index), geometry.count - 1)
  const targetHeight = geometry.heights[targetIndex]!
  return Math.max(
    0,
    geometry.offsets[targetIndex]! +
      Math.min(anchor.offsetWithinItem, Math.max(0, targetHeight - 1))
  )
}

export function topForMarkdownIndex({
  geometry,
  index,
}: {
  geometry: MarkdownVirtualGeometry
  index: number
}) {
  if (geometry.count === 0) return 0

  const targetIndex = Math.min(Math.max(0, index), geometry.count - 1)
  return geometry.offsets[targetIndex]!
}

function resolveMarkdownItemHeight({
  estimateHeight,
  index,
  key,
  measuredHeights,
}: {
  estimateHeight: (index: number) => number
  index: number
  key: string
  measuredHeights: ReadonlyMap<string, number>
}) {
  return Math.max(1, measuredHeights.get(key) ?? estimateHeight(index))
}

function findFirstItemWithBottomAtOrAfter(
  offsets: readonly number[],
  target: number
) {
  let low = 0
  let high = Math.max(0, offsets.length - 1)

  while (low < high) {
    const middle = Math.floor((low + high) / 2)
    if (offsets[middle + 1]! >= target) {
      high = middle
    } else {
      low = middle + 1
    }
  }

  return low
}

function findFirstItemWithTopAfter(
  offsets: readonly number[],
  target: number
) {
  let low = 0
  let high = Math.max(0, offsets.length - 1)

  while (low < high) {
    const middle = Math.floor((low + high) / 2)
    if (offsets[middle]! > target) {
      high = middle
    } else {
      low = middle + 1
    }
  }

  return low
}
