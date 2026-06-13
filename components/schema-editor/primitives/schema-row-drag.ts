import type * as React from "react"

export interface SchemaRowDragItem {
  id: string
  label: string
}

export type SchemaRowDropIndicator = "before" | "after" | null

const ROW_DRAG_FORMAT = "text/plain"
const DROP_CLASSES = [
  "border-t-2",
  "border-b-2",
  "border-grey-700",
  "border-dashed",
] as const

export function getSchemaRowDropIndicator({
  rowIds,
  sourceRowId,
  targetRowId,
}: {
  rowIds: string[]
  sourceRowId: string | null
  targetRowId: string
}): SchemaRowDropIndicator {
  if (!sourceRowId || sourceRowId === targetRowId) return null

  const sourceIndex = rowIds.indexOf(sourceRowId)
  const targetIndex = rowIds.indexOf(targetRowId)
  if (sourceIndex < 0 || targetIndex < 0) return null

  return sourceIndex > targetIndex ? "before" : "after"
}

export function getSchemaRowDropClasses(
  indicator: SchemaRowDropIndicator
): string[] {
  if (!indicator) return []
  return [
    indicator === "before" ? "border-t-2" : "border-b-2",
    "border-grey-700",
    "border-dashed",
  ]
}

export function clearSchemaRowDropClasses(element: HTMLElement) {
  element.classList.remove(...DROP_CLASSES)
}

export function applySchemaRowDropClasses(
  element: HTMLElement,
  indicator: SchemaRowDropIndicator
) {
  clearSchemaRowDropClasses(element)
  const classes = getSchemaRowDropClasses(indicator)
  if (classes.length) element.classList.add(...classes)
}

export function getSchemaRowDropTargetIndex({
  rowIds,
  targetRowId,
}: {
  rowIds: string[]
  targetRowId: string
}) {
  return rowIds.indexOf(targetRowId)
}

export function beginSchemaRowDrag({
  event,
  item,
  draggedRowIdRef,
}: {
  event: React.DragEvent<HTMLElement>
  item: SchemaRowDragItem
  draggedRowIdRef: React.RefObject<string | null>
}) {
  event.stopPropagation()
  event.dataTransfer.setData(ROW_DRAG_FORMAT, item.id)
  event.dataTransfer.effectAllowed = "move"
  draggedRowIdRef.current = item.id

  const dragElement = createSchemaRowDragPreview({
    sourceElement: event.currentTarget,
    label: item.label,
  })
  event.dataTransfer.setDragImage(dragElement, 10, 10)
  removeSchemaRowDragPreviewAfterFrame(dragElement)
}

export function updateSchemaRowDragTarget({
  event,
  rowIds,
  targetRowId,
  draggedRowIdRef,
}: {
  event: React.DragEvent<HTMLElement>
  rowIds: string[]
  targetRowId: string
  draggedRowIdRef: React.RefObject<string | null>
}) {
  event.preventDefault()
  const indicator = getSchemaRowDropIndicator({
    rowIds,
    sourceRowId: draggedRowIdRef.current,
    targetRowId,
  })

  event.dataTransfer.dropEffect = "move"
  applySchemaRowDropClasses(event.currentTarget, indicator)
}

export function leaveSchemaRowDragTarget(
  event: Pick<
    React.DragEvent<HTMLElement>,
    "currentTarget" | "stopPropagation"
  >
) {
  event.stopPropagation()
  clearSchemaRowDropClasses(event.currentTarget)
}

export function resolveSchemaRowDrop({
  event,
  rowIds,
  targetRowId,
  draggedRowIdRef,
}: {
  event: React.DragEvent<HTMLElement>
  rowIds: string[]
  targetRowId: string
  draggedRowIdRef: React.RefObject<string | null>
}): {
  sourceRowId: string
  targetIndex: number
} | null {
  event.stopPropagation()
  event.preventDefault()
  const sourceRowId = event.dataTransfer.getData(ROW_DRAG_FORMAT)
  clearSchemaRowDropClasses(event.currentTarget)

  if (
    !sourceRowId ||
    sourceRowId === targetRowId ||
    draggedRowIdRef.current !== sourceRowId ||
    !rowIds.includes(sourceRowId) ||
    !rowIds.includes(targetRowId)
  ) {
    return null
  }

  return {
    sourceRowId,
    targetIndex: getSchemaRowDropTargetIndex({ rowIds, targetRowId }),
  }
}

function createSchemaRowDragPreview({
  sourceElement,
  label,
}: {
  sourceElement: HTMLElement
  label: string
}) {
  const dragElement = document.createElement("div")
  const rect = sourceElement.getBoundingClientRect()

  Object.assign(dragElement.style, {
    width: `${rect.width}px`,
    padding: "8px",
    border: "1px solid var(--ring)",
    borderRadius: "4px",
    backgroundColor: "var(--background)",
    boxShadow: "0 2px 5px rgba(0,0,0,0.1)",
    opacity: "0.8",
    position: "fixed",
    zIndex: "9999",
    pointerEvents: "none",
  })
  dragElement.textContent = label
  document.body.appendChild(dragElement)

  return dragElement
}

function removeSchemaRowDragPreviewAfterFrame(dragElement: HTMLElement) {
  window.requestAnimationFrame(() => {
    dragElement.remove()
  })
}
