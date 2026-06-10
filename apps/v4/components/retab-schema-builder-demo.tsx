"use client"

import * as React from "react"

import { JsonSchemaEditor } from "@/components/schema-editor/json-schema-builder"
import { JsonSchemaEditorProvider } from "@/components/schema-editor/contexts/json-schema"
import { type ExtendedJSONSchema7 } from "@/components/schema-editor/lib/json-schema-types"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

const initialSchema: ExtendedJSONSchema7 = {
  type: "object",
  title: "Invoice",
  properties: {
    invoice_number: { type: "string", description: "The invoice identifier" },
    total: { type: "number", description: "Total amount due" },
    currency: { type: "string", enum: ["USD", "EUR", "GBP"] },
    paid: { type: "boolean" },
    vendor: {
      type: "object",
      description: "Who issued the invoice",
      properties: {
        name: { type: "string" },
        country: { anyOf: [{ type: "string" }, { type: "null" }] },
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
  const [schema, setSchema] = React.useState<ExtendedJSONSchema7>(initialSchema)
  return (
    <Tabs defaultValue="schema" className="not-prose w-full gap-3">
      <TabsList>
        <TabsTrigger value="schema">Schema</TabsTrigger>
        <TabsTrigger value="json">JSON</TabsTrigger>
      </TabsList>
      <TabsContent value="schema">
        <div className="rounded-xl border bg-card p-3">
          <JsonSchemaEditorProvider jsonSchema={schema} setJsonSchema={setSchema}>
            <JsonSchemaEditor />
          </JsonSchemaEditorProvider>
        </div>
      </TabsContent>
      <TabsContent value="json">
        <pre className="max-h-[560px] overflow-auto rounded-xl border bg-muted/40 p-4 font-mono text-xs">
          {JSON.stringify(schema, null, 2)}
        </pre>
      </TabsContent>
    </Tabs>
  )
}
