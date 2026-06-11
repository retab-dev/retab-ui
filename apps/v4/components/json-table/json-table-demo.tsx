"use client";

import * as React from "react";
import type { JSONSchema7 } from "json-schema";

import type { TableDocument } from "@/components/json-table/lib/projects-types";
import { stripReasoningFields } from "@/components/json-table/lib/json-schema-utils";
import { SingleFileTableView } from "@/components/json-table/single-file-table-view";
import sampleSchema from "@/components/json-table/sample/schema.json";
import sampleData from "@/components/json-table/sample/data.json";

/** Recursively drop Retab's `X-Reasoning*` schema extensions so the table
 *  renders no reasoning columns/indicators. */
function stripSchemaReasoning(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(stripSchemaReasoning);
  if (node && typeof node === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(node)) {
      if (key.startsWith("X-Reasoning")) continue;
      out[key] = stripSchemaReasoning(value);
    }
    return out;
  }
  return node;
}

// Real extraction: a 60-day business checking statement with 1,500 transaction
// rows — a long flat array that exercises the table's virtualization.
// `prediction` is the extracted output object.
const document = {
  id: "doc_1",
  project_id: "proj_1",
  mime_data: {
    id: "file_1",
    filename: "bank-statement.pdf",
    mime_type: "application/pdf",
  },
  prediction_data: {
    prediction: stripReasoningFields(sampleData) as Record<string, unknown>,
  },
  extraction_id: null,
} as unknown as TableDocument;

const schema = stripSchemaReasoning(sampleSchema) as unknown as JSONSchema7;

export function JsonTableDemo() {
  const [currentSchema, setSchema] = React.useState<JSONSchema7>(schema);
  const [editable, setEditable] = React.useState(false);
  return (
    <div className="not-prose my-6 flex flex-col gap-2">
      <label className="flex items-center gap-2 text-sm text-muted-foreground">
        <input
          type="checkbox"
          checked={editable}
          onChange={(e) => setEditable(e.target.checked)}
          className="size-4 accent-primary"
        />
        Editable {editable ? "(double-click a cell to edit)" : "(read-only)"}
      </label>
      <div className="flex h-[480px] flex-col overflow-hidden rounded-xl border bg-background">
        <SingleFileTableView
          document={document}
          schema={currentSchema}
          setSchema={setSchema}
          editMode={editable ? "editable" : "readOnly"}
          allowEditing={editable}
        />
      </div>
    </div>
  );
}
