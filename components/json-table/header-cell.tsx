import React, { useState } from "react"
import type { JSONSchema7 } from "json-schema"
import { ChevronDown, ChevronUp } from "lucide-react"

import { HeaderLabel } from "@/components/json-table/header-label"
import { HeaderSchemaMenu } from "@/components/json-table/header-schema-menu"
import type { JsonTableHeaderNode } from "@/components/json-table/lib/header-nodes"
import { getColumnWidthPx } from "@/components/json-table/table-options-store"
import type { ColumnWidth } from "@/components/json-table/table-options-store"
import { useHeaderController } from "@/components/json-table/use-header-controller"
import { Button } from "@/components/ui-retab/button"

interface JsonTableHeaderCellProps {
  node: JsonTableHeaderNode
  leafCount: number
  schema: JSONSchema7
  setSchema: (schema: JSONSchema7) => void
  stopAt: string[]
  setStopAt: (stopAt: string[]) => void
  columnWidth: ColumnWidth
  isPublished: boolean
  draggedItemKeyRef: React.RefObject<string | null>
  draggedItemParentPathRef: React.RefObject<string | null>
  editMode: "descriptionOnly" | "editable" | "readOnly"
  disableHeaderInteractions?: boolean
}

export function JsonTableHeaderCell({
  node,
  leafCount,
  schema,
  setSchema,
  stopAt,
  setStopAt,
  columnWidth,
  isPublished,
  draggedItemKeyRef,
  draggedItemParentPathRef,
  editMode,
  disableHeaderInteractions = false,
}: JsonTableHeaderCellProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const {
    isDraggable,
    clearDragClasses,
    handleDragStart,
    handleDragOver,
    handleDrop,
    handleDragEnd,
    toggleExpanded,
  } = useHeaderController({
    node,
    schema,
    setSchema,
    stopAt,
    setStopAt,
    draggedItemKeyRef,
    draggedItemParentPathRef,
    disableHeaderInteractions,
  })

  if (node.isArrayValuePlaceholder) {
    return (
      <Button
        variant="ghost"
        size="icon"
        className="grow justify-start rounded-none bg-transparent px-1 text-foreground hover:bg-muted/40"
      >
        <HeaderLabel
          effectiveType={node.itemEffectiveType ?? node.effectiveType}
          label={node.label}
          width={getColumnWidthPx(columnWidth) - 20}
        />
      </Button>
    )
  }

  const label = (
    <HeaderLabel
      effectiveType={node.effectiveType}
      label={node.label}
      width={
        getColumnWidthPx(columnWidth) * (node.isExpanded ? leafCount : 1) -
        (node.canFold ? 44 : 20)
      }
    />
  )

  return (
    <div
      className="group flex h-full w-full"
      draggable={isDraggable}
      onDragStart={handleDragStart}
      onDragOver={isDraggable ? handleDragOver : undefined}
      onDragLeave={(event) => clearDragClasses(event.currentTarget)}
      onDrop={isDraggable ? handleDrop : undefined}
      onDragEnd={handleDragEnd}
    >
      {disableHeaderInteractions ? (
        <div className="flex h-full grow items-center justify-start rounded-none bg-transparent px-1 text-foreground">
          {label}
        </div>
      ) : (
        <HeaderSchemaMenu
          node={node}
          schema={schema}
          setSchema={setSchema}
          isPublished={isPublished}
          editMode={editMode}
          open={dropdownOpen}
          onOpenChange={setDropdownOpen}
        >
          <Button
            variant="ghost"
            size="sm"
            className="h-full grow justify-start rounded-none bg-transparent px-1 text-foreground hover:bg-muted/40"
          >
            {label}
          </Button>
        </HeaderSchemaMenu>
      )}

      {node.canFold && (
        <Button
          variant="ghost"
          size="icon"
          className={`h-full ${node.isArray ? "w-9" : "w-6"} rounded-none bg-transparent text-foreground hover:bg-muted/40`}
          onClick={toggleExpanded}
        >
          {stopAt.includes(node.key) ? (
            <ChevronDown className="size-3" />
          ) : (
            <ChevronUp className="size-3" />
          )}
        </Button>
      )}
    </div>
  )
}
