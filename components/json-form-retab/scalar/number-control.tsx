"use client";

import {
  DataCell,
  parseDataCellNumberInput,
  type DataCellCommitValue,
  type DataCellValueMeta,
} from "@/components/ui/data-cell";
import { Input } from "@/components/ui/input";
import { useJsonFormReadOnly } from "@/components/json-form-retab/read-only";
import {
  compactJsonFormDataCellClass,
  type ControlFieldApi,
  type ScalarControlDomProps,
} from "@/components/json-form-retab/scalar/types";

export function NumberControl({
  kind,
  field,
  compact,
  nullable,
  ...controlProps
}: {
  kind: "number" | "integer";
  field: ControlFieldApi;
  compact: boolean;
  nullable: boolean;
} & ScalarControlDomProps) {
  const readOnly = useJsonFormReadOnly();

  if (!compact) {
    return (
      <Input
        {...controlProps}
        nativeInput
        readOnly={readOnly}
        type="number"
        inputMode={kind === "integer" ? "numeric" : "decimal"}
        step={kind === "integer" ? 1 : "any"}
        value={field.value == null ? "" : String(field.value)}
        onChange={(event) =>
          updateNumberValue({
            kind,
            value: event.currentTarget.value,
            nullable,
            field,
          })
        }
        onBlur={field.onBlur}
        name={field.name}
      />
    );
  }

  return (
    <DataCell
      {...controlProps}
      kind={kind}
      active={!readOnly}
      value={dataCellNumberValue(field.value)}
      draftValue={field.value == null ? "" : String(field.value)}
      className={compactJsonFormDataCellClass}
      onDraftValueChange={(value, meta) =>
        updateNumberValue({ kind, value, meta, nullable, field })
      }
      onCommit={(value, meta) =>
        updateNumberValue({ kind, value, meta, nullable, field })
      }
      onBlur={field.onBlur}
      name={field.name}
    />
  );
}

function updateNumberValue({
  kind,
  value,
  meta,
  nullable,
  field,
}: {
  kind: "number" | "integer";
  value: DataCellCommitValue | string;
  meta?: DataCellValueMeta;
  nullable: boolean;
  field: ControlFieldApi;
}) {
  const rawValue = meta?.rawValue ?? (typeof value === "string" ? value : "");
  const parsed = parseDataCellNumberInput({ kind, value: rawValue });

  if (!parsed.isValid) return;
  if (parsed.isEmpty) {
    field.onChange(nullable ? null : undefined);
    return;
  }
  field.onChange(parsed.value);
}

export function dataCellNumberValue(value: unknown): string | number | null {
  return typeof value === "number" || typeof value === "string" ? value : null;
}
