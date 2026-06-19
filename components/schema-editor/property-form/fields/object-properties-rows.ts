import type { ExtendedJSONSchema7 } from "@/components/schema-editor/lib/json-schema-types";
import { isSchemaNode } from "@/components/schema-editor/property-form/model/object-property-selectors";
import type { ObjectPropertyRowModel } from "@/components/schema-editor/property-form/model/object-properties-view";
import type { PropertyObjectPropertiesPlan } from "@/components/schema-editor/property-form/types";
import { validatePropertyFormName } from "@/components/schema-editor/property-form/validation";

import { createObjectPropertyRowSchemaPlan } from "./object-property-row-schema-plan";
import type { ObjectPropertyOperations } from "./object-properties-operations";
import type { ObjectPropertiesState } from "./object-properties-state";
import { createPropertyTypeFieldWithObjectTemplates } from "./property-object-template-type-field";

export function createObjectPropertyRows({
  operations,
  plan,
  state,
}: {
  operations: ObjectPropertyOperations;
  plan: PropertyObjectPropertiesPlan;
  state: ObjectPropertiesState;
}): ObjectPropertyRowModel[] {
  return state.propertyNames.flatMap((name, index) => {
    const propertySchema = plan.schemaNode.properties?.[name];
    if (!isSchemaNode(propertySchema)) return [];

    const id = state.rowIdentity.getRowId(name);
    const replaceSchemaNode = (nextSchemaNode: ExtendedJSONSchema7) => {
      operations.replacePropertySchemaNode(name, nextSchemaNode);
    };
    const rowSchemaContext = {
      ...plan.schemaContext,
      siblingNames: state.propertyNames,
      originalName: name,
      fieldPath: [
        plan.schemaContext.fieldPath ?? plan.schemaContext.originalName,
        id,
      ].join("."),
      resetKey: [
        plan.schemaContext.resetKey ??
          plan.schemaContext.fieldPath ??
          plan.schemaContext.originalName,
        id,
      ].join("."),
    };

    return [
      {
        id,
        schemaPlan: createObjectPropertyRowSchemaPlan({
          access: plan.access,
          editable: plan.editable,
          mode: plan.mode,
          schemaNode: propertySchema,
          schemaContext: rowSchemaContext,
          onChange: replaceSchemaNode,
        }),
        name,
        nameField: {
          ariaLabel: `Field name ${name}`,
          value: name,
          editable: plan.editable,
          validate: (value: string) =>
            validatePropertyFormName({
              name: value,
              siblingNames: state.propertyNames,
              originalName: name,
            }),
          onCommit: (nextName: string) => {
            operations.renameProperty(name, nextName);
          },
        },
        descriptionField: {
          ariaLabel: `Description for ${name}`,
          value: propertySchema.description || "",
          editable: plan.editable,
          onCommit: (description: string) => {
            replaceSchemaNode({
              ...propertySchema,
              description: description || undefined,
            });
          },
        },
        reorder: {
          move: (targetIndex: number) => {
            operations.moveProperty({
              propertyName: name,
              sourceIndex: index,
              targetIndex,
            });
          },
        },
        typeField: createPropertyTypeFieldWithObjectTemplates({
          schemaNode: propertySchema,
          schemaContext: rowSchemaContext,
          editable: plan.editable && plan.access.type,
          onChange: replaceSchemaNode,
        }),
        deleteAction: {
          label: `Remove field ${name}`,
          onDelete: () => operations.removeProperty(name),
        },
      },
    ];
  });
}
