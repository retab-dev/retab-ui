"use client";

import type * as React from "react";

import { ObjectPropertiesField } from "@/components/schema-editor/property-form/fields/object-properties-field";
import { useObjectPropertiesModel } from "@/components/schema-editor/property-form/fields/object-properties-model";
import type {
  PropertyObjectPropertiesPlan,
  PropertySchemaPlan,
} from "@/components/schema-editor/property-form/types";

export function ObjectPropertiesPlanField({
  plan,
  renderPlan,
}: {
  plan: PropertyObjectPropertiesPlan;
  renderPlan: (plan: PropertySchemaPlan) => React.ReactNode;
}) {
  const objectProperties = useObjectPropertiesModel(plan);
  return (
    <ObjectPropertiesField model={objectProperties} renderPlan={renderPlan} />
  );
}
