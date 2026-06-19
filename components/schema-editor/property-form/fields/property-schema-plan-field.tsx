"use client";

import { ArrayItemsField } from "@/components/schema-editor/property-form/fields/array-items-field";
import { EnumValuesField } from "@/components/schema-editor/property-form/fields/enum-values-field";
import { ObjectPropertiesPlanField } from "@/components/schema-editor/property-form/fields/object-properties-plan-field";
import { TypeField } from "@/components/schema-editor/property-form/fields/type-field";
import type { PropertySchemaPlan } from "@/components/schema-editor/property-form/types";

export function PropertySchemaPlanField({
  plan,
}: {
  plan: PropertySchemaPlan;
}) {
  const renderPlan = (schemaPlan: PropertySchemaPlan) => (
    <PropertySchemaPlanField plan={schemaPlan} />
  );

  return (
    <div className="space-y-3">
      {plan.items.map((item) => {
        switch (item.kind) {
          case "type":
            return <TypeField key={item.kind} field={item.field} />;
          case "enumValues":
            return (
              <EnumValuesField
                key={item.kind}
                values={item.field.values}
                resetKey={item.field.resetKey}
                disabled={item.field.disabled}
                onChange={item.field.onChange}
              />
            );
          case "objectProperties":
            return (
              <ObjectPropertiesPlanField
                key={item.kind}
                plan={item.plan}
                renderPlan={renderPlan}
              />
            );
          case "arrayItems":
            return (
              <ArrayItemsField key={item.kind}>
                <PropertySchemaPlanField plan={item.itemSchemaPlan} />
              </ArrayItemsField>
            );
        }
      })}
    </div>
  );
}
