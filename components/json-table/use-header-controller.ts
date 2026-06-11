import * as React from "react"
import type { JSONSchema7 } from "json-schema"

import type { JsonTableHeaderNode } from "@/components/json-table/lib/header-nodes"
import {
  getSchemaPropertyType,
  resolveSchema,
} from "@/components/json-table/lib/schema-inspection"
import { reorderSchemaProperty } from "@/components/json-table/lib/schema-mutations"

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
  const parentSchema = node.parentPath
    ? getSchemaPropertyType(schema, node.parentPath)
    : schema
  const isDraggable =
    !disableHeaderInteractions && parentSchema && parentSchema.type === "object"

  const clearDragClasses = React.useCallback((element: HTMLElement) => {
    element.classList.remove(
      "border-l-2",
      "border-r-2",
      "border-r-primary",
      "border-l-primary"
    )
  }, [])

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

      const dragImage = document.createElement("div")
      dragImage.textContent = node.label
      dragImage.style.position = "absolute"
      dragImage.style.top = "-1000px"
      dragImage.style.left = "-1000px"
      dragImage.style.padding = "4px 8px"
      dragImage.style.backgroundColor = "var(--popover)"
      dragImage.style.color = "var(--popover-foreground)"
      dragImage.style.border = "1px solid var(--border)"
      dragImage.style.borderRadius = "var(--radius-sm)"
      dragImage.style.fontSize = "var(--text-xs)"
      dragImage.style.fontFamily = "var(--font-sans)"
      document.body.appendChild(dragImage)
      event.dataTransfer.setDragImage(dragImage, 10, 10)
      setTimeout(() => {
        document.body.removeChild(dragImage)
      }, 0)
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

      const parentNode = node.parentPath
        ? resolveSchema(getSchemaPropertyType(schema, node.parentPath), schema)
        : resolveSchema(schema, schema)

      if (
        !parentNode ||
        parentNode.type !== "object" ||
        !parentNode.properties
      ) {
        return
      }

      const propKeys = Object.keys(parentNode.properties)
      const sourceIndex = propKeys.indexOf(sourcePropName)
      const targetIndex = propKeys.indexOf(node.propName)
      if (sourceIndex === -1 || targetIndex === -1) return

      if (sourceIndex < targetIndex) {
        event.currentTarget.classList.add("border-r-2", "border-r-primary")
      } else {
        event.currentTarget.classList.add("border-l-2", "border-l-primary")
      }
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

      const sourcePropName = draggedItemKeyRef.current
      const sourceParentPath = draggedItemParentPathRef.current

      if (
        sourcePropName &&
        sourceParentPath === node.parentPath &&
        sourcePropName !== node.propName
      ) {
        setSchema(
          reorderSchemaProperty({
            schema,
            parentPath: node.parentPath,
            sourcePropName,
            targetPropName: node.propName,
          })
        )
      }

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
