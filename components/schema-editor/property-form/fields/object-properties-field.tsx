"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import { SchemaAddRow } from "@/components/schema-editor/primitives/schema-add-row"
import { SchemaFieldRow } from "@/components/schema-editor/primitives/schema-field-row"
import { SchemaInlineDescription } from "@/components/schema-editor/primitives/schema-inline-description"
import { SchemaInlineName } from "@/components/schema-editor/primitives/schema-inline-name"
import { SchemaRowActions } from "@/components/schema-editor/primitives/schema-row-actions"
import type {
  PropertyObjectPropertiesFieldModel,
  PropertySchemaDetailsModel,
} from "@/components/schema-editor/property-form/types"

import { useObjectPropertiesDrag } from "./object-properties-drag"
import { useObjectPropertiesModel } from "./object-properties-model"
import { TypeField } from "./type-field"

export function ObjectPropertiesField({
  details,
  renderPropertyDetails,
}: {
  details: PropertyObjectPropertiesFieldModel
  renderPropertyDetails: (
    details: PropertySchemaDetailsModel
  ) => React.ReactNode
}) {
  const { access, editable, mode, onChange, schemaContext, schemaNode } =
    details
  const model = useObjectPropertiesModel({
    access,
    editable,
    mode,
    schemaNode,
    schemaContext,
    onChange,
  })
  const drag = useObjectPropertiesDrag({
    rows: model.rows,
    editable,
  })
  const rootRef = React.useRef<HTMLDivElement>(null)
  const pendingReorderFocusLabelRef = React.useRef<string | null>(null)
  const [reorderAnnouncement, setReorderAnnouncement] = React.useState("")

  React.useLayoutEffect(() => {
    const label = pendingReorderFocusLabelRef.current
    if (!label) return

    const button = Array.from(
      rootRef.current?.querySelectorAll("button") ?? []
    ).find((candidate) => candidate.getAttribute("aria-label") === label)
    if (button instanceof HTMLButtonElement && !button.disabled) {
      button.focus()
    }
    pendingReorderFocusLabelRef.current = null
  }, [model.rows])

  const restoreReorderFocusAfterMove = (label: string) => {
    pendingReorderFocusLabelRef.current = label
  }

  const announceMove = (
    row: (typeof model.rows)[number],
    nextPosition: number
  ) => {
    setReorderAnnouncement(
      `${row.name} moved to position ${nextPosition} of ${row.reorder.rowCount}`
    )
  }

  return (
    <div ref={rootRef} className="space-y-2 pl-2">
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {reorderAnnouncement}
      </div>
      {model.rows.map((row) => (
        <div
          key={row.id}
          className={cn(
            "ml-4 border-l border-border",
            editable && "cursor-grab"
          )}
          data-property-form-row-id={row.id}
          data-property-form-property-name={row.name}
          {...drag.getRowDragProps(row)}
        >
          <SchemaFieldRow
            grip={editable ? "drag" : "empty"}
            name={
              <SchemaInlineName
                ariaLabel={`Field name ${row.name}`}
                value={row.name}
                editable={editable}
                validate={row.validation.name}
                onCommit={row.actions.rename}
              />
            }
            description={
              <SchemaInlineDescription
                ariaLabel={`Description for ${row.name}`}
                value={row.schemaNode.description || ""}
                editable={editable}
                onCommit={(description) => {
                  row.actions.replaceSchemaNode({
                    ...row.schemaNode,
                    description: description || undefined,
                  })
                }}
              />
            }
            actions={
              <SchemaRowActions
                canDelete={true}
                editable={editable}
                deleteLabel={`Remove field ${row.name}`}
                onDelete={row.actions.remove}
                reorder={
                  row.reorder.rowCount > 1
                    ? {
                        canMoveDown: row.reorder.canMoveDown,
                        canMoveUp: row.reorder.canMoveUp,
                        moveDownLabel: `Move field ${row.name} down`,
                        moveUpLabel: `Move field ${row.name} up`,
                        onMoveDown: () => {
                          restoreReorderFocusAfterMove(
                            `Move field ${row.name} down`
                          )
                          row.reorder.moveDown()
                          announceMove(row, row.reorder.position + 1)
                        },
                        onMoveUp: () => {
                          restoreReorderFocusAfterMove(
                            `Move field ${row.name} up`
                          )
                          row.reorder.moveUp()
                          announceMove(row, row.reorder.position - 1)
                        },
                      }
                    : undefined
                }
              />
            }
            type={
              <TypeField
                schemaNode={row.schemaNode}
                schemaContext={row.schemaContext}
                fieldPath={row.schemaContext.fieldPath}
                editable={row.type.editable}
                variant="row"
                onChange={row.type.onChange}
              />
            }
          />
          {renderPropertyDetails(row.details)}
        </div>
      ))}

      <SchemaAddRow
        className="ml-4 border-l border-border pl-4"
        disabled={!editable}
        error={model.addRow.error}
        inputLabel="New object field"
        placeholder="New property name"
        submitLabel="Add"
        value={model.addRow.value}
        onChange={model.addRow.onChange}
        onSubmit={model.addRow.onSubmit}
      />
    </div>
  )
}
