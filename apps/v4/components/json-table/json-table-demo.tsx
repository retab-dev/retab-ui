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

// Real extraction: an oil & gas revenue statement (nested check + properties →
// production → line items). `prediction` is the extracted output object.
const document = {
  id: "doc_1",
  project_id: "proj_1",
  mime_data: {
    id: "file_1",
    filename: "revenue-statement.pdf",
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
  return (
    <div className="not-prose flex h-[480px] flex-col overflow-hidden rounded-xl border bg-background">
      <SingleFileTableView
        document={document}
        schema={currentSchema}
        setSchema={setSchema}
        editMode="readOnly"
      />
    </div>
  );
}
