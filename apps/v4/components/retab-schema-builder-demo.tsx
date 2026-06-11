"use client"

import * as React from "react"
import { type JSONSchema7 } from "json-schema"

import { SchemaBuilder } from "@/registry/new-york-v4/ui/schema-builder"

const initialSchema: JSONSchema7 = {
  type: "object",
  title: "Invoice",
  $defs: {
    Money: {
      type: "object",
      description: "An amount in a given currency.",
      properties: {
        amount: { type: "number", description: "Numeric amount." },
        currency: {
          type: "string",
          enum: ["USD", "EUR", "GBP"],
          description: "ISO 4217 currency code.",
        },
      },
      required: ["amount"],
    },
  },
  properties: {
    invoice_number: { type: "string", description: "The invoice identifier" },
    total: { $ref: "#/$defs/Money", description: "Total amount due" },
    paid: { type: "boolean" },
    vendor: {
      type: "object",
      description: "Who issued the invoice",
      properties: {
        name: { type: "string" },
        country: { type: ["string", "null"] },
      },
      required: ["name"],
    },
    line_items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          description: { type: "string" },
          quantity: { type: "integer" },
        },
        required: ["description"],
      },
    },
  },
  required: ["invoice_number", "total"],
}

export function RetabSchemaBuilderDemo() {
  const [schema, setSchema] = React.useState<JSONSchema7>(initialSchema)
  return (
    <div className="not-prose w-full">
      <SchemaBuilder value={schema} onValueChange={setSchema} />
    </div>
  )
}
