"use client";

import * as React from "react";

import { getObjectPropertyNames } from "@/components/schema-editor/property-form/model/object-property-selectors";
import type { PropertyObjectPropertiesPlan } from "@/components/schema-editor/property-form/types";

import {
  type ObjectPropertyRowIdentity,
  useObjectPropertyRowIdentity,
} from "./object-property-row-identity";

export interface ObjectPropertiesState {
  addInputValue: string;
  propertyNames: string[];
  rowIdentity: ObjectPropertyRowIdentity;
  setAddInputValue: (value: string) => void;
}

export function useObjectPropertiesState(
  plan: PropertyObjectPropertiesPlan,
): ObjectPropertiesState {
  const [addInputValue, setAddInputValue] = React.useState("");
  const propertyNames = getObjectPropertyNames(plan.schemaNode);
  const resetAddInputValue = React.useCallback(() => {
    setAddInputValue("");
  }, []);
  const rowIdentity = useObjectPropertyRowIdentity({
    onExternalPropertyNamesChange: resetAddInputValue,
    propertyNames,
    resetKey: plan.schemaContext.resetKey ?? plan.schemaContext.originalName,
  });

  return {
    addInputValue,
    propertyNames,
    rowIdentity,
    setAddInputValue,
  };
}
