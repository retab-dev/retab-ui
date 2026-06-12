import type * as React from "react"

import {
  applyPropertyDropClasses,
  clearPropertyDropClasses,
  getPropertyDropIndicator,
  getPropertyDropTargetIndex,
} from "@/components/schema-editor/document-property-reorder"

interface PropertyDragDataTransfer {
  effectAllowed: DataTransfer["effectAllowed"]
  setData(format: string, data: string): void
  setDragImage(image: Element, x: number, y: number): void
}

interface PropertyDragTargetDataTransfer {
  dropEffect: DataTransfer["dropEffect"]
}

interface PropertyDropDataTransfer {
  getData(format: string): string
}

interface PropertyDragEvent {
  currentTarget: HTMLElement
  dataTransfer: PropertyDragDataTransfer
  stopPropagation(): void
}

interface PropertyDragTargetEvent {
  currentTarget: HTMLElement
  dataTransfer: PropertyDragTargetDataTransfer
  preventDefault(): void
}

export interface PropertyDropEvent {
  currentTarget: HTMLElement
  dataTransfer: PropertyDropDataTransfer
  preventDefault(): void
  stopPropagation(): void
}

interface BeginPropertyDragOptions {
  event: PropertyDragEvent
  path: string
  propertyId: string
  propertyName: string
  draggedParentRef: React.RefObject<string | null>
  draggedPropertyRef: React.RefObject<string | null>
}

export function beginPropertyDrag({
  event,
  path,
  propertyId,
  propertyName,
  draggedParentRef,
  draggedPropertyRef,
}: BeginPropertyDragOptions) {
  event.stopPropagation()
  event.dataTransfer.setData("text/plain", propertyId)
  event.dataTransfer.effectAllowed = "move"
  draggedParentRef.current = path
  draggedPropertyRef.current = propertyId

  const dragElement = createPropertyDragPreview({
    sourceElement: event.currentTarget,
    propertyName,
  })
  event.dataTransfer.setDragImage(dragElement, 10, 10)
  removePropertyDragPreviewAfterFrame(dragElement)
}

interface UpdatePropertyDragTargetOptions {
  event: PropertyDragTargetEvent
  path: string
  targetPropertyId: string
  propertyIds: string[]
  draggedParentRef: React.RefObject<string | null>
  draggedPropertyRef: React.RefObject<string | null>
}

export function updatePropertyDragTarget({
  event,
  path,
  targetPropertyId,
  propertyIds,
  draggedParentRef,
  draggedPropertyRef,
}: UpdatePropertyDragTargetOptions) {
  event.preventDefault()
  const indicator = getPropertyDropIndicator({
    propertyIds,
    sourcePropertyId: draggedPropertyRef.current,
    targetPropertyId,
  })

  event.dataTransfer.dropEffect = "move"
  applyPropertyDropClasses(
    event.currentTarget,
    draggedParentRef.current === path ? indicator : null
  )
}

export function leavePropertyDragTarget(
  event: Pick<PropertyDropEvent, "currentTarget" | "stopPropagation">
) {
  event.stopPropagation()
  clearPropertyDropClasses(event.currentTarget)
}

interface ResolvePropertyDropOptions {
  event: PropertyDropEvent
  path: string
  targetPropertyId: string
  propertyIds: string[]
  draggedParentRef: React.RefObject<string | null>
}

export function resolvePropertyDrop({
  event,
  path,
  targetPropertyId,
  propertyIds,
  draggedParentRef,
}: ResolvePropertyDropOptions): {
  sourcePropertyId: string
  targetIndex: number
} | null {
  event.stopPropagation()
  event.preventDefault()
  const sourcePropertyId = event.dataTransfer.getData("text/plain")
  clearPropertyDropClasses(event.currentTarget)

  if (
    !sourcePropertyId ||
    sourcePropertyId === targetPropertyId ||
    draggedParentRef.current !== path
  ) {
    return null
  }

  return {
    sourcePropertyId,
    targetIndex: getPropertyDropTargetIndex({
      propertyIds,
      targetPropertyId,
    }),
  }
}

function createPropertyDragPreview({
  sourceElement,
  propertyName,
}: {
  sourceElement: HTMLElement
  propertyName: string
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
  dragElement.textContent = propertyName
  document.body.appendChild(dragElement)

  return dragElement
}

function removePropertyDragPreviewAfterFrame(dragElement: HTMLElement) {
  window.requestAnimationFrame(() => {
    dragElement.remove()
  })
}
