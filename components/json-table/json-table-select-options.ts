import type { DataCellSelectOption } from "@/components/ui/data-cell";
import type { FieldMetadata } from "@/components/json-table/lib/schema-field-metadata";

const nullSelectOptionValue = "__json_table_null__";

export function jsonTableSelectOptions(
  fieldMetadata: FieldMetadata,
): DataCellSelectOption[] {
  if (fieldMetadata.kind !== "enum") return [];

  const disabledEnumValues = disabledJsonTableEnumValues(fieldMetadata);
  const nullOption: DataCellSelectOption[] = fieldMetadata.isNullable
    ? [
        {
          value: nullSelectOptionValue,
          label: "No selection",
          className: "text-xs text-muted-foreground",
        },
      ]
    : [];

  return [
    ...nullOption,
    ...fieldMetadata.enumValues
      .map((optionJsonValue, optionIndex) => ({
        optionJsonValue,
        optionIndex,
      }))
      .filter(
        ({ optionJsonValue }) =>
          optionJsonValue !== undefined &&
          optionJsonValue !== null &&
          !(typeof optionJsonValue === "string" && optionJsonValue === ""),
      )
      .map(({ optionJsonValue, optionIndex }) => ({
        value: selectOptionValue(optionIndex),
        label: String(optionJsonValue),
        disabled: disabledEnumValues.some((disabledJsonValue) =>
          jsonValuesEqual(disabledJsonValue, optionJsonValue),
        ),
        className: "text-xs",
      })),
  ];
}

function disabledJsonTableEnumValues(fieldMetadata: FieldMetadata): unknown[] {
  const rawSchema = fieldMetadata.rawSchema as Record<string, unknown>;
  const effectiveSchema = fieldMetadata.effectiveSchema as Record<
    string,
    unknown
  >;
  const disabledValues =
    rawSchema["x-disabled-enum-values"] ??
    effectiveSchema["x-disabled-enum-values"];

  return Array.isArray(disabledValues) ? disabledValues : [];
}

export function jsonTableSelectValue({
  fieldMetadata,
  jsonValue,
}: {
  fieldMetadata: FieldMetadata;
  jsonValue: unknown;
}): string | null {
  if (fieldMetadata.kind !== "enum") {
    return jsonValue === null || jsonValue === undefined
      ? null
      : String(jsonValue);
  }

  if (jsonValue === null || jsonValue === undefined) {
    return nullSelectOptionValue;
  }

  const matchingIndex = fieldMetadata.enumValues.findIndex((optionJsonValue) =>
    jsonValuesEqual(optionJsonValue, jsonValue),
  );

  return matchingIndex === -1
    ? String(jsonValue)
    : selectOptionValue(matchingIndex);
}

export function jsonTableSelectCommitValue({
  fieldMetadata,
  commitValue,
}: {
  fieldMetadata: FieldMetadata;
  commitValue: string;
}): unknown {
  if (
    commitValue === nullSelectOptionValue &&
    fieldMetadata.kind === "enum" &&
    fieldMetadata.isNullable
  ) {
    return null;
  }

  if (!commitValue.startsWith("option:")) return commitValue;

  const optionIndex = Number(commitValue.slice("option:".length));

  return fieldMetadata.kind === "enum" &&
    Number.isInteger(optionIndex) &&
    optionIndex in fieldMetadata.enumValues
    ? fieldMetadata.enumValues[optionIndex]
    : commitValue;
}

export function jsonTableSelectDisplayText({
  isNullable,
  jsonValue,
}: {
  isNullable: boolean;
  jsonValue: unknown;
}): string {
  if (jsonValue === null || jsonValue === undefined) {
    return isNullable ? "No selection" : "";
  }
  return String(jsonValue);
}

function selectOptionValue(optionIndex: number): string {
  return `option:${optionIndex}`;
}

function jsonValuesEqual(
  leftJsonValue: unknown,
  rightJsonValue: unknown,
): boolean {
  if (Object.is(leftJsonValue, rightJsonValue)) return true;
  if (typeof leftJsonValue !== typeof rightJsonValue) return false;
  if (leftJsonValue === null || rightJsonValue === null) return false;
  if (typeof leftJsonValue !== "object" || typeof rightJsonValue !== "object") {
    return false;
  }

  if (Array.isArray(leftJsonValue) || Array.isArray(rightJsonValue)) {
    if (!Array.isArray(leftJsonValue) || !Array.isArray(rightJsonValue)) {
      return false;
    }
    return (
      leftJsonValue.length === rightJsonValue.length &&
      leftJsonValue.every((itemJsonValue, index) =>
        jsonValuesEqual(itemJsonValue, rightJsonValue[index]),
      )
    );
  }

  const leftRecord = leftJsonValue as Record<string, unknown>;
  const rightRecord = rightJsonValue as Record<string, unknown>;
  const leftKeys = Object.keys(leftRecord);
  const rightKeys = Object.keys(rightRecord);

  return (
    leftKeys.length === rightKeys.length &&
    leftKeys.every((key) =>
      Object.prototype.hasOwnProperty.call(rightRecord, key),
    ) &&
    leftKeys.every((key) => jsonValuesEqual(leftRecord[key], rightRecord[key]))
  );
}
