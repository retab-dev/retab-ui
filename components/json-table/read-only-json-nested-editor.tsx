import type { JSONSchema7 } from "json-schema";

import {
  ArrayEditor as JsonArrayEditor,
  ObjectEditor as JsonObjectEditor,
} from "@/components/json-table/object-editor";

export function ReadOnlyJsonNestedEditor({
  currentValue,
  kind,
  name,
  property,
}: {
  currentValue: unknown;
  kind: "array" | "object";
  name: string;
  property: JSONSchema7;
}) {
  return kind === "array" ? (
    <JsonArrayEditor
      name={name}
      disabled
      property={property}
      currentValue={currentValue}
      onSubmit={() => {}}
    />
  ) : (
    <JsonObjectEditor
      disabled
      property={property}
      currentValue={currentValue}
      onSubmit={() => {}}
    />
  );
}
