export function moveOrderedItem<T>({
  items,
  sourceIndex,
  targetIndex,
}: {
  items: readonly T[]
  sourceIndex: number
  targetIndex: number
}): T[] {
  const nextItems = items.slice()
  if (sourceIndex < 0 || sourceIndex >= nextItems.length) return nextItems

  const [movedItem] = nextItems.splice(sourceIndex, 1)
  const clampedTargetIndex = Math.max(
    0,
    Math.min(targetIndex, nextItems.length)
  )
  nextItems.splice(clampedTargetIndex, 0, movedItem)
  return nextItems
}
