import type { ExtendedJSONSchema7 } from "@/components/schema-editor/lib/json-schema-types";
import { moveOrderedItem } from "@/components/schema-editor/primitives/schema-order";
import {
  createObjectPropertySchema,
  moveObjectProperty,
  removeObjectProperty,
  renameObjectProperty,
  replaceObjectProperty,
} from "@/components/schema-editor/property-form/model/object-property-edits";
import type { PropertyObjectPropertiesPlan } from "@/components/schema-editor/property-form/types";

import type { ObjectPropertiesState } from "./object-properties-state";

export interface ObjectPropertyOperations {
  addProperty: (propertyName: string) => void;
  moveProperty: (input: {
    propertyName: string;
    sourceIndex: number;
    targetIndex: number;
  }) => void;
  removeProperty: (propertyName: string) => void;
  renameProperty: (oldName: string, newName: string) => void;
  replacePropertySchemaNode: (
    propertyName: string,
    propertySchema: ExtendedJSONSchema7,
  ) => void;
}

export function createObjectPropertyOperations({
  plan,
  state,
}: {
  plan: PropertyObjectPropertiesPlan;
  state: ObjectPropertiesState;
}): ObjectPropertyOperations {
  const replacePropertySchemaNode = (
    propertyName: string,
    propertySchema: ExtendedJSONSchema7,
  ) => {
    plan.onChange(
      replaceObjectProperty({
        schemaNode: plan.schemaNode,
        propertyName,
        propertySchema,
      }),
    );
  };

  return {
    addProperty: (propertyName) => {
      state.rowIdentity.preserveAddRowForLocalPropertyNames([
        ...state.propertyNames,
        propertyName,
      ]);
      state.rowIdentity.addRowId(propertyName);
      replacePropertySchemaNode(
        propertyName,
        createObjectPropertySchema(propertyName),
      );
      state.setAddInputValue("");
    },
    moveProperty: ({ propertyName, sourceIndex, targetIndex }) => {
      state.rowIdentity.preserveAddRowForLocalPropertyNames(
        moveOrderedItem({
          items: state.propertyNames,
          sourceIndex,
          targetIndex,
        }),
      );
      plan.onChange(
        moveObjectProperty({
          schemaNode: plan.schemaNode,
          propertyName,
          targetIndex,
        }),
      );
    },
    removeProperty: (propertyName) => {
      state.rowIdentity.preserveAddRowForLocalPropertyNames(
        state.propertyNames.filter((name) => name !== propertyName),
      );
      state.rowIdentity.removeRowId(propertyName);
      plan.onChange(
        removeObjectProperty({
          schemaNode: plan.schemaNode,
          propertyName,
        }),
      );
    },
    renameProperty: (oldName, newName) => {
      state.rowIdentity.preserveAddRowForLocalPropertyNames(
        state.propertyNames.map((propertyName) =>
          propertyName === oldName ? newName : propertyName,
        ),
      );
      state.rowIdentity.renameRowId(oldName, newName);
      plan.onChange(
        renameObjectProperty({
          schemaNode: plan.schemaNode,
          oldName,
          newName,
        }),
      );
    },
    replacePropertySchemaNode,
  };
}
