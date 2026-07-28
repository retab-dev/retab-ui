"use client";

import {
  BooleanControl,
  NullableBooleanControl,
} from "@/components/json-form-retab/scalar/boolean-control";
import {
  datetimeLocalInputValue,
  DateTimeScalarControl,
} from "@/components/json-form-retab/scalar/date-time-control";
import {
  EnumControl,
  enumLabel,
  enumValueEquals,
} from "@/components/json-form-retab/scalar/enum-control";
import {
  dataCellNumberValue,
  NumberControl,
} from "@/components/json-form-retab/scalar/number-control";
import {
  dataCellTextValue,
  TextControl,
} from "@/components/json-form-retab/scalar/text-control";
import type {
  ControlFieldApi,
  DateTimeControlKind,
  JsonFormTextInput,
  ScalarControlDomProps,
} from "@/components/json-form-retab/scalar/types";
import type {
  FieldKind,
  Schema,
} from "@/components/json-form-retab/schema-model";

export type {
  ControlFieldApi,
  JsonFormTextInput,
  ScalarControlDomProps,
} from "@/components/json-form-retab/scalar/types";
export {
  BooleanControl,
  dataCellNumberValue,
  dataCellTextValue,
  datetimeLocalInputValue,
  enumLabel,
  enumValueEquals,
  NullableBooleanControl,
};

export function ScalarControl({
  kind,
  schema,
  field,
  textInput,
  compact = false,
  nullable = false,
  ...controlProps
}: {
  kind: FieldKind;
  schema: Schema;
  field: ControlFieldApi;
  textInput?: JsonFormTextInput;
  /** Dense, single-line variant for table cells. */
  compact?: boolean;
  nullable?: boolean;
} & ScalarControlDomProps) {
  if (kind === "enum") {
    return (
      <EnumControl
        {...controlProps}
        schema={schema}
        field={field}
        compact={compact}
        nullable={nullable}
      />
    );
  }

  if (kind === "number" || kind === "integer") {
    return (
      <NumberControl
        {...controlProps}
        kind={kind}
        field={field}
        compact={compact}
        nullable={nullable}
      />
    );
  }

  if (
    schema.format === "date" ||
    schema.format === "time" ||
    schema.format === "date-time"
  ) {
    return (
      <DateTimeScalarControl
        {...controlProps}
        kind={schema.format as DateTimeControlKind}
        field={field}
        compact={compact}
        nullable={nullable}
      />
    );
  }

  return (
    <TextControl
      {...controlProps}
      schema={schema}
      field={field}
      textInput={textInput}
      compact={compact}
      nullable={nullable}
    />
  );
}
