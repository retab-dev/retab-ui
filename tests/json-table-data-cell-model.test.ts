import type { JSONSchema7 } from "json-schema";
import { describe, expect, it } from "vitest";

import type { DataCellValueMeta } from "@/components/ui/data-cell";
import { createJsonTableDataCellProps } from "@/components/json-table/json-table-data-cell-model";
import { jsonTableDisplayText } from "@/components/json-table/json-table-display-value";
import type {
  FieldKind,
  FieldMetadata,
} from "@/components/json-table/lib/schema-field-metadata";

function fieldMetadata({
  disabledEnumValues,
  enumValues = [],
  isNullable = false,
  kind,
}: {
  disabledEnumValues?: unknown[];
  enumValues?: unknown[];
  isNullable?: boolean;
  kind: FieldKind;
}): FieldMetadata {
  const rawSchema: JSONSchema7 =
    disabledEnumValues === undefined
      ? {}
      : ({ "x-disabled-enum-values": disabledEnumValues } as JSONSchema7);

  return {
    effectiveSchema: rawSchema,
    enumValues,
    fieldPath: "field",
    isNullable,
    kind,
    rawSchema,
    schema: {},
  };
}

function dataCellValueMeta(
  kind: DataCellValueMeta["kind"],
  rawValue: string,
): DataCellValueMeta {
  return {
    kind,
    rawValue,
    isEmpty: rawValue === "",
    isValid: true,
  };
}

describe("json table DataCell model", () => {
  it("projects exact DataCell props for each primitive kind", () => {
    const observedKinds = [
      createJsonTableDataCellProps({
        fieldMetadata: fieldMetadata({ kind: "string" }),
        value: "ACME",
      }).kind,
      createJsonTableDataCellProps({
        fieldMetadata: fieldMetadata({ kind: "number" }),
        value: 12.5,
      }).kind,
      createJsonTableDataCellProps({
        fieldMetadata: fieldMetadata({ kind: "integer" }),
        value: 12,
      }).kind,
      createJsonTableDataCellProps({
        fieldMetadata: fieldMetadata({ kind: "boolean" }),
        value: true,
      }).kind,
      createJsonTableDataCellProps({
        fieldMetadata: fieldMetadata({ kind: "date" }),
        value: "2025-07-18",
      }).kind,
      createJsonTableDataCellProps({
        fieldMetadata: fieldMetadata({ kind: "time" }),
        value: "09:30:00",
      }).kind,
      createJsonTableDataCellProps({
        fieldMetadata: fieldMetadata({ kind: "date-time" }),
        value: "2025-07-18T09:30:00Z",
      }).kind,
      createJsonTableDataCellProps({
        fieldMetadata: fieldMetadata({
          enumValues: ["draft"],
          kind: "enum",
        }),
        value: "draft",
      }).kind,
    ];

    expect(observedKinds).toEqual([
      "text",
      "number",
      "integer",
      "boolean",
      "date",
      "time",
      "date-time",
      "select",
    ]);
  });

  it("keeps JSON commit reconstruction inside DataCell props projection", () => {
    const approved = { code: "approved" };
    const rejected = { code: "rejected" };
    const committedValues: unknown[] = [];
    const props = createJsonTableDataCellProps({
      fieldMetadata: fieldMetadata({
        enumValues: [approved, rejected],
        kind: "enum",
      }),
      value: approved,
      onCommit: (value) => committedValues.push(value),
    });

    expect(props.kind).toBe("select");
    if (props.kind !== "select") throw new Error("Expected select props");

    props.onCommit?.("option:1", {
      kind: "select",
      rawValue: "option:1",
      isEmpty: false,
      isValid: true,
    });

    expect(committedValues).toEqual([rejected]);
  });

  it("maps primitive enum values to select options and commits the original JSON value", () => {
    const committedValues: unknown[] = [];
    const metadata = fieldMetadata({
      enumValues: ["draft", "approved"],
      kind: "enum",
    });
    const props = createJsonTableDataCellProps({
      fieldMetadata: metadata,
      value: "approved",
      onCommit: (value) => committedValues.push(value),
    });

    expect(props.kind).toBe("select");
    if (props.kind !== "select") throw new Error("Expected select props");
    expect(props.value).toBe("option:1");
    expect(props.selectOptions.map((option) => option.value)).toEqual([
      "option:0",
      "option:1",
    ]);
    props.onCommit?.("option:0", dataCellValueMeta("select", "option:0"));
    expect(committedValues).toEqual(["draft"]);
  });

  it("commits object enum values by original object identity", () => {
    const approved = { code: "approved" };
    const rejected = { code: "rejected" };
    const committedValues: unknown[] = [];
    const metadata = fieldMetadata({
      enumValues: [approved, rejected],
      kind: "enum",
    });
    const props = createJsonTableDataCellProps({
      fieldMetadata: metadata,
      value: { code: "approved" },
      onCommit: (value) => committedValues.push(value),
    });

    expect(props.kind).toBe("select");
    if (props.kind !== "select") throw new Error("Expected select props");
    expect(props.value).toBe("option:0");
    props.onCommit?.("option:0", dataCellValueMeta("select", "option:0"));
    props.onCommit?.("option:1", dataCellValueMeta("select", "option:1"));
    expect(committedValues[0]).toBe(approved);
    expect(committedValues[1]).toBe(rejected);
  });

  it("marks schema-disabled enum values as disabled select options", () => {
    const metadata = fieldMetadata({
      disabledEnumValues: ["archived"],
      enumValues: ["draft", "archived", "approved"],
      kind: "enum",
    });
    const props = createJsonTableDataCellProps({
      fieldMetadata: metadata,
      value: "draft",
    });

    expect(props.kind).toBe("select");
    if (props.kind !== "select") throw new Error("Expected select props");
    expect(
      props.selectOptions.map((option) => option.disabled ?? false),
    ).toEqual([false, true, false]);
  });

  it("maps nullable enum null through a table-local select sentinel", () => {
    const committedValues: unknown[] = [];
    const metadata = fieldMetadata({
      enumValues: ["draft"],
      isNullable: true,
      kind: "enum",
    });
    const props = createJsonTableDataCellProps({
      fieldMetadata: metadata,
      value: null,
      onCommit: (value) => committedValues.push(value),
    });

    expect(props.kind).toBe("select");
    if (props.kind !== "select") throw new Error("Expected select props");
    expect(props.value).not.toBeNull();
    expect(props.selectOptions[0]?.label).toBe("No selection");
    const sentinelValue = props.value;
    if (sentinelValue === undefined || sentinelValue === null) {
      throw new Error("Expected select sentinel value");
    }
    props.onCommit?.(sentinelValue, dataCellValueMeta("select", sentinelValue));
    expect(committedValues).toEqual([null]);
  });

  it("keeps unknown enum values as strings", () => {
    const committedValues: unknown[] = [];
    const metadata = fieldMetadata({
      enumValues: ["draft"],
      kind: "enum",
    });
    const props = createJsonTableDataCellProps({
      fieldMetadata: metadata,
      value: "archived",
      onCommit: (value) => committedValues.push(value),
    });

    expect(props.kind).toBe("select");
    if (props.kind !== "select") throw new Error("Expected select props");
    expect(props.value).toBe("archived");
    props.onCommit?.("archived", dataCellValueMeta("select", "archived"));
    expect(committedValues).toEqual(["archived"]);
  });

  it("uses display date text while committing normalized JSON dates", () => {
    const committedValues: unknown[] = [];
    const metadata = fieldMetadata({ kind: "date" });
    const props = createJsonTableDataCellProps({
      fieldMetadata: metadata,
      value: "2025-07-18",
      onCommit: (value) => committedValues.push(value),
    });

    expect(props.kind).toBe("date");
    if (props.kind !== "date") throw new Error("Expected date props");
    expect(
      jsonTableDisplayText({
        fieldMetadata: metadata,
        jsonValue: "2025-07-18",
      }),
    ).toBe("Jul 18, 2025");
    props.onCommit?.("7/18/2025", dataCellValueMeta("date", "7/18/2025"));
    expect(committedValues).toEqual(["2025-07-18"]);
  });

  it("adds seconds when committing time values without seconds", () => {
    const committedValues: unknown[] = [];
    const metadata = fieldMetadata({ kind: "time" });
    const props = createJsonTableDataCellProps({
      fieldMetadata: metadata,
      value: "09:30:00",
      onCommit: (value) => committedValues.push(value),
    });

    expect(props.kind).toBe("time");
    if (props.kind !== "time") throw new Error("Expected time props");
    props.onCommit?.("09:45", dataCellValueMeta("time", "09:45"));
    expect(committedValues).toEqual(["09:45:00"]);
  });

  it("projects number and integer values as number DataCell values", () => {
    const numberProps = createJsonTableDataCellProps({
      fieldMetadata: fieldMetadata({ kind: "number" }),
      value: "12.5",
    });
    const integerProps = createJsonTableDataCellProps({
      fieldMetadata: fieldMetadata({ kind: "integer" }),
      value: 12,
    });

    expect(numberProps.kind).toBe("number");
    expect(numberProps.value).toBe("12.5");
    expect(integerProps.kind).toBe("integer");
    expect(integerProps.value).toBe(12);
  });

  it("projects structured fallback values as text", () => {
    const committedValues: unknown[] = [];
    const metadata = fieldMetadata({ kind: "object" });
    const props = createJsonTableDataCellProps({
      fieldMetadata: metadata,
      value: { vendor: "ACME" },
      onCommit: (value) => committedValues.push(value),
    });

    expect(props.kind).toBe("text");
    if (props.kind !== "text") throw new Error("Expected text props");
    expect(props.value).toBe('{"vendor":"ACME"}');
    props.onCommit?.("updated", dataCellValueMeta("text", "updated"));
    expect(committedValues).toEqual(["updated"]);
  });
});
