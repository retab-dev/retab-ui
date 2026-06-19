"use client";

import * as React from "react";

import { cn } from "@/lib/utils";
import { SchemaFieldRow } from "@/components/schema-editor/primitives/schema-field-row";
import { SchemaInlineDescription } from "@/components/schema-editor/primitives/schema-inline-description";
import { SchemaInlineName } from "@/components/schema-editor/primitives/schema-inline-name";
import { SchemaRowActions } from "@/components/schema-editor/primitives/schema-row-actions";
import type {
  ObjectPropertyRowModel,
  PropertyObjectPropertiesFieldModel,
} from "@/components/schema-editor/property-form/model/object-properties-view";
import type { PropertySchemaPlan } from "@/components/schema-editor/property-form/types";

import { useObjectPropertiesRowDrag } from "./object-properties-drag";
import { TypeField } from "./type-field";

interface ObjectPropertyRowsProps {
  model: PropertyObjectPropertiesFieldModel;
  renderPlan: (plan: PropertySchemaPlan) => React.ReactNode;
}

interface ObjectPropertyRowProps {
  editable: boolean;
  row: ObjectPropertyRowModel;
  rowDragProps: React.HTMLAttributes<HTMLDivElement>;
  renderPlan: (plan: PropertySchemaPlan) => React.ReactNode;
}

export function ObjectPropertyRows({
  model,
  renderPlan,
}: ObjectPropertyRowsProps) {
  const rowDrag = useObjectPropertiesRowDrag({
    rows: model.rows,
    editable: model.editable,
  });

  return (
    <div className="space-y-2">
      {model.rows.map((row) => (
        <ObjectPropertyRow
          key={row.id}
          editable={model.editable}
          row={row}
          rowDragProps={rowDrag.getRowDragProps(row)}
          renderPlan={renderPlan}
        />
      ))}
    </div>
  );
}

export function ObjectPropertyRow({
  editable,
  row,
  rowDragProps,
  renderPlan,
}: ObjectPropertyRowProps) {
  return (
    <div
      className={cn("border-border ml-4 border-l", editable && "cursor-grab")}
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
          <SchemaRowActions
            canDelete={true}
            editable={editable}
            deleteLabel={row.deleteAction.label}
            onDelete={row.deleteAction.onDelete}
          />
        }
        type={<TypeField field={row.typeField} variant="row" />}
      />
      {renderPlan(row.schemaPlan)}
    </div>
  );
}
