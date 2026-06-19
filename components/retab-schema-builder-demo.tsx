"use client";

import * as React from "react";

import { type ExtendedJSONSchema7 } from "@/components/schema-editor/lib/json-schema-types";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SchemaBuilder } from "@/components/ui/schema-builder";

const initialSchema: ExtendedJSONSchema7 = {
  type: "object",
  title: "Invoice",
  properties: {
    invoice_number: { type: "string", description: "The invoice identifier" },
    total: { type: "number", description: "Total amount due" },
    currency: { type: "string", enum: ["USD", "EUR", "GBP"] },
    paid: { type: "boolean" },
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
};

export function RetabSchemaBuilderDemo({
  showJsonTab = false,
}: {
  /** Hide the Schema/JSON toggle and render the editor on its own. */
  showJsonTab?: boolean;
}) {
  const [schema, setSchema] =
    React.useState<ExtendedJSONSchema7>(initialSchema);

  const editor = <SchemaBuilder value={schema} onValueChange={setSchema} />;

  if (!showJsonTab) {
    return <div className="not-prose w-full">{editor}</div>;
  }

  return (
    <Tabs defaultValue="schema" className="not-prose w-full gap-3">
      <TabsList>
        <TabsTrigger value="schema">Schema</TabsTrigger>
        <TabsTrigger value="json">JSON</TabsTrigger>
      </TabsList>
      <TabsContent value="schema">{editor}</TabsContent>
      <TabsContent value="json">
        <pre className="bg-muted/40 max-h-[560px] overflow-auto rounded-xl border p-4 font-mono text-xs shadow-sm">
          {JSON.stringify(schema, null, 2)}
        </pre>
      </TabsContent>
    </Tabs>
  );
}
