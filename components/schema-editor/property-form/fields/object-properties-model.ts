"use client";

import type { PropertyObjectPropertiesFieldModel } from "@/components/schema-editor/property-form/model/object-properties-view";
import type { PropertyObjectPropertiesPlan } from "@/components/schema-editor/property-form/types";

import { createObjectPropertyAddInput } from "./object-property-add-input";
import { createObjectPropertyOperations } from "./object-properties-operations";
import { createObjectPropertyRows } from "./object-properties-rows";
import { useObjectPropertiesState } from "./object-properties-state";

export function useObjectPropertiesModel(
  plan: PropertyObjectPropertiesPlan,
): PropertyObjectPropertiesFieldModel {
  const state = useObjectPropertiesState(plan);
  const operations = createObjectPropertyOperations({
    plan,
    state,
  });
  const rows = createObjectPropertyRows({ operations, plan, state });

  return {
    addInput: createObjectPropertyAddInput({
      onSubmit: operations.addProperty,
      state: {
        propertyNames: state.propertyNames,
        value: state.addInputValue,
        setValue: state.setAddInputValue,
      },
    }),
    editable: plan.editable,
    rows,
  };
}
