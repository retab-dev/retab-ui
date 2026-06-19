import { jsonTableSelectCommitValue } from "@/components/json-table/json-table-select-options";
import { dateStringToFormat } from "@/components/json-table/lib/date-display-formatting";
import type { FieldMetadata } from "@/components/json-table/lib/schema-field-metadata";

export function jsonTableCommitValue({
  fieldMetadata,
  commitValue,
}: {
  fieldMetadata: FieldMetadata;
  commitValue: string | number | boolean | null;
}): unknown {
  if (fieldMetadata.kind === "enum" && typeof commitValue === "string") {
    return jsonTableSelectCommitValue({ fieldMetadata, commitValue });
  }

  if (typeof commitValue !== "string") return commitValue;

  if (fieldMetadata.kind === "date") {
    return dateStringToFormat(commitValue, "2000-01-01") || null;
  }

  if (fieldMetadata.kind === "time") {
    const valueWithSeconds =
      commitValue && /^\d{1,2}:\d{2}$/.test(commitValue)
        ? `${commitValue}:00`
        : commitValue;
    return dateStringToFormat(valueWithSeconds, "00:00") || null;
  }

  if (fieldMetadata.kind === "date-time") {
    return dateStringToFormat(commitValue, "2000-01-01T00:00:00") || null;
  }

  return commitValue;
}
