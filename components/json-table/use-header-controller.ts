import * as React from "react"
import type { JSONSchema7 } from "json-schema"

import {
  applyHeaderDropClass,
  clearHeaderDragClasses,
  createHeaderDragPreview,
  scheduleHeaderDragPreviewRemoval,
} from "@/components/json-table/header-drag-ui"
import {
  buildHeaderDropSchema,
  canDragHeaderNode,
  getHeaderDropSide,
} from "@/components/json-table/lib/header-drag-model"
import type { JsonTableHeaderNode } from "@/components/json-table/lib/header-nodes"

export function useHeaderController({
  node,
  schema,
  setSchema,
  stopAt,
  setStopAt,
  draggedItemKeyRef,
  draggedItemParentPathRef,
  disableHeaderInteractions,
}: {
  node: JsonTableHeaderNode
  schema: JSONSchema7
  setSchema: (schema: JSONSchema7) => void
  stopAt: string[]
  setStopAt: (stopAt: string[]) => void
  draggedItemKeyRef: React.RefObject<string | null>
  draggedItemParentPathRef: React.RefObject<string | null>
  disableHeaderInteractions: boolean
}) {
  const isDraggable = canDragHeaderNode({
    node,
    schema,
    disableHeaderInteractions,
  })

  const clearDragClasses = clearHeaderDragClasses

  const handleDragStart = React.useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      if (!isDraggable) {
        event.preventDefault()
        return
      }

      event.dataTransfer.setData("text/plain", node.propName)
      event.dataTransfer.effectAllowed = "move"
      draggedItemKeyRef.current = node.propName
      draggedItemParentPathRef.current = node.parentPath

      const dragImage = createHeaderDragPreview(node.label)
      event.dataTransfer.setDragImage(dragImage, 10, 10)
      scheduleHeaderDragPreviewRemoval(dragImage)
    },
    [draggedItemKeyRef, draggedItemParentPathRef, isDraggable, node]
  )

  const handleDragOver = React.useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault()
      const sourcePropName = draggedItemKeyRef.current

      if (
        draggedItemParentPathRef.current !== node.parentPath ||
        !sourcePropName ||
        sourcePropName === node.propName
      ) {
        return
      }

      event.dataTransfer.dropEffect = "move"
      clearDragClasses(event.currentTarget)

      const dropSide = getHeaderDropSide({ node, schema, sourcePropName })
      applyHeaderDropClass(event.currentTarget, dropSide)
    },
    [
      clearDragClasses,
      draggedItemKeyRef,
      draggedItemParentPathRef,
      node,
      schema,
    ]
  )

  const handleDrop = React.useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault()
      clearDragClasses(event.currentTarget)

      const nextSchema = buildHeaderDropSchema({
        node,
        schema,
        sourcePropName: draggedItemKeyRef.current,
        sourceParentPath: draggedItemParentPathRef.current,
      })
      if (nextSchema) setSchema(nextSchema)

      draggedItemKeyRef.current = null
      draggedItemParentPathRef.current = null
    },
    [
      clearDragClasses,
      draggedItemKeyRef,
      draggedItemParentPathRef,
      node,
      schema,
      setSchema,
    ]
  )

  const handleDragEnd = React.useCallback(() => {
    draggedItemKeyRef.current = null
    draggedItemParentPathRef.current = null
  }, [draggedItemKeyRef, draggedItemParentPathRef])

  const toggleExpanded = React.useCallback(() => {
    if (stopAt.includes(node.key)) {
      setStopAt(stopAt.filter((path) => path !== node.key))
    } else {
      setStopAt([...stopAt, node.key])
    }
  }, [node.key, setStopAt, stopAt])

  return {
    isDraggable,
    clearDragClasses,
    handleDragStart,
    handleDragOver,
    handleDrop,
    handleDragEnd,
    toggleExpanded,
  }
}
