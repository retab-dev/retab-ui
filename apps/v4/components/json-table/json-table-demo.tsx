"use client";

import * as React from "react";
import type { JSONSchema7 } from "json-schema";

import type { TableDocument } from "@/components/json-table/lib/projects-types";
import { SingleFileTableView } from "@/components/json-table/single-file-table-view";

const document = {
  id: "doc_1",
  project_id: "proj_1",
  mime_data: {
    id: "file_1",
    filename: "invoice.pdf",
    mime_type: "application/pdf",
  },
  prediction_data: {
    prediction: {
      invoice_number: "INV-1024",
      total: 1280.5,
      paid: false,
      vendor: { name: "Acme Corp", country: "US" },
      line_items: [
        { description: "Widget", quantity: 3, unit_price: 426.83 },
        { description: "Gadget", quantity: 1, unit_price: 0 },
      ],
    },
  },
  extraction_id: null,
} as unknown as TableDocument;

const schema: JSONSchema7 = {
  type: "object",
  properties: {
    invoice_number: { type: "string", title: "Invoice #" },
    total: { type: "number", title: "Total" },
    paid: { type: "boolean", title: "Paid" },
    vendor: {
      type: "object",
      title: "Vendor",
      properties: {
        name: { type: "string", title: "Name" },
        country: { type: "string", title: "Country" },
      },
    },
    line_items: {
      type: "array",
      title: "Line items",
      items: {
        type: "object",
        properties: {
          description: { type: "string", title: "Description" },
          quantity: { type: "integer", title: "Qty" },
          unit_price: { type: "number", title: "Unit price" },
        },
      },
    },
  },
};

export function JsonTableDemo() {
  const [currentSchema, setSchema] = React.useState<JSONSchema7>(schema);
  return (
    <div className="not-prose h-[480px] overflow-auto rounded-xl border bg-white">
      <SingleFileTableView
        document={document}
        schema={currentSchema}
        setSchema={setSchema}
        editMode="readOnly"
      />
    </div>
  );
}
