"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import { SchemaFieldRow } from "@/components/schema-editor/primitives/schema-field-row"
import { SchemaInlineDescription } from "@/components/schema-editor/primitives/schema-inline-description"
import { SchemaInlineName } from "@/components/schema-editor/primitives/schema-inline-name"
import { SchemaRowActions } from "@/components/schema-editor/primitives/schema-row-actions"
import { SchemaRowReorderActions } from "@/components/schema-editor/primitives/schema-row-reorder-actions"
import type {
  ObjectPropertyRowModel,
  PropertyObjectPropertiesFieldModel,
} from "@/components/schema-editor/property-form/model/object-properties-view"
import type { PropertySchemaPlan } from "@/components/schema-editor/property-form/types"

import { useObjectPropertiesRowDrag } from "./object-properties-drag"
import type { ObjectPropertyReorderFocusController } from "./object-properties-reorder-focus"
import { useObjectPropertyReorderFocus } from "./object-properties-reorder-focus"
import { TypeField } from "./type-field"

interface ObjectPropertyRowsProps {
  model: PropertyObjectPropertiesFieldModel
  renderPlan: (plan: PropertySchemaPlan) => React.ReactNode
}

interface ObjectPropertyRowProps {
  editable: boolean
  reorderFocus: ObjectPropertyReorderFocusController
  row: ObjectPropertyRowModel
  rowDragProps: React.HTMLAttributes<HTMLDivElement>
  renderPlan: (plan: PropertySchemaPlan) => React.ReactNode
  onReorderAnnouncement: (
    row: ObjectPropertyRowModel,
    nextPosition: number
  ) => void
}

export function ObjectPropertyRows({
  model,
  renderPlan,
}: ObjectPropertyRowsProps) {
  const rowDrag = useObjectPropertiesRowDrag({
    rows: model.rows,
    editable: model.editable,
  })
  const reorderFocus = useObjectPropertyReorderFocus(model.rows)
  const [reorderAnnouncement, setReorderAnnouncement] = React.useState("")

  const announceReorder = (
    row: ObjectPropertyRowModel,
    nextPosition: number
  ) => {
    setReorderAnnouncement(
      `${row.name} moved to position ${nextPosition} of ${row.reorder.rowCount}`
    )
  }

  return (
    <div ref={reorderFocus.rootRef} className="space-y-2">
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {reorderAnnouncement}
      </div>
      {model.rows.map((row) => (
        <ObjectPropertyRow
          key={row.id}
          editable={model.editable}
          reorderFocus={reorderFocus}
          row={row}
          rowDragProps={rowDrag.getRowDragProps(row)}
          renderPlan={renderPlan}
          onReorderAnnouncement={announceReorder}
        />
      ))}
    </div>
  )
}

export function ObjectPropertyRow({
  editable,
  reorderFocus,
  row,
  rowDragProps,
  renderPlan,
  onReorderAnnouncement,
}: ObjectPropertyRowProps) {
  return (
    <div
      className={cn("ml-4 border-l border-border", editable && "cursor-grab")}
      data-property-form-row-id={row.id}
      data-property-form-property-name={row.name}
      {...rowDragProps}
    >
      <SchemaFieldRow
        grip={editable ? "drag" : "empty"}
        name={
          <SchemaInlineName
            ariaLabel={row.nameField.ariaLabel}
            value={row.nameField.value}
            editable={row.nameField.editable}
            validate={row.nameField.validate}
            onCommit={row.nameField.onCommit}
          />
        }
        description={
          <SchemaInlineDescription
            ariaLabel={row.descriptionField.ariaLabel}
            value={row.descriptionField.value}
            editable={row.descriptionField.editable}
            onCommit={row.descriptionField.onCommit}
          />
        }
        actions={
          <>
            {row.reorder.rowCount > 1 ? (
              <SchemaRowReorderActions
                canMoveDown={row.reorder.canMoveDown}
                canMoveUp={row.reorder.canMoveUp}
                moveDownAttributes={reorderFocus.getActionAttributes({
                  direction: "down",
                  rowId: row.id,
                })}
                moveDownLabel={row.reorder.moveDownLabel}
                moveUpAttributes={reorderFocus.getActionAttributes({
                  direction: "up",
                  rowId: row.id,
                })}
                moveUpLabel={row.reorder.moveUpLabel}
                onMoveDown={() => {
                  reorderFocus.restoreAfterMove({
                    direction: "down",
                    rowId: row.id,
                  })
                  row.reorder.moveDown()
                  onReorderAnnouncement(row, row.reorder.position + 1)
                }}
                onMoveUp={() => {
                  reorderFocus.restoreAfterMove({
                    direction: "up",
                    rowId: row.id,
                  })
                  row.reorder.moveUp()
                  onReorderAnnouncement(row, row.reorder.position - 1)
                }}
              />
            ) : null}
            <SchemaRowActions
              canDelete={true}
              editable={editable}
              deleteLabel={row.deleteAction.label}
              onDelete={row.deleteAction.onDelete}
            />
          </>
        }
        type={<TypeField field={row.typeField} variant="row" />}
      />
      {renderPlan(row.schemaPlan)}
    </div>
  )
}
