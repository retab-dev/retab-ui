export type PropertyDropIndicator = "before" | "after" | null

const DROP_CLASSES = [
  "border-t-2",
  "border-b-2",
  "border-grey-700",
  "border-dashed",
] as const

export function getPropertyDropIndicator({
  propertyIds,
  sourcePropertyId,
  targetPropertyId,
}: {
  propertyIds: string[]
  sourcePropertyId: string | null
  targetPropertyId: string
}): PropertyDropIndicator {
  if (!sourcePropertyId || sourcePropertyId === targetPropertyId) return null

  const sourceIndex = propertyIds.indexOf(sourcePropertyId)
  const targetIndex = propertyIds.indexOf(targetPropertyId)
  if (sourceIndex < 0 || targetIndex < 0) return null

  return sourceIndex > targetIndex ? "before" : "after"
}

export function getPropertyDropClasses(
  indicator: PropertyDropIndicator
): string[] {
  if (!indicator) return []
  return [
    indicator === "before" ? "border-t-2" : "border-b-2",
    "border-grey-700",
    "border-dashed",
  ]
}

export function clearPropertyDropClasses(element: HTMLElement) {
  element.classList.remove(...DROP_CLASSES)
}

export function applyPropertyDropClasses(
  element: HTMLElement,
  indicator: PropertyDropIndicator
) {
  clearPropertyDropClasses(element)
  const classes = getPropertyDropClasses(indicator)
  if (classes.length) element.classList.add(...classes)
}

export function getPropertyDropTargetIndex({
  propertyIds,
  targetPropertyId,
}: {
  propertyIds: string[]
  targetPropertyId: string
}) {
  return propertyIds.indexOf(targetPropertyId)
}
