import type * as React from "react";

import type { JsonFormTextInput } from "@/components/json-form-retab/scalar-control";
import type { Schema } from "@/components/json-form-retab/schema-model";

export interface JsonFormFieldRenderProps {
  name: string;
  sourcePath?: string;
  schema: Schema;
  required?: boolean;
  label?: string;
  textInput?: JsonFormTextInput;
  className?: string;
  depth?: number;
}

export type RenderJsonFormField = (
  props: JsonFormFieldRenderProps,
) => React.ReactNode;
