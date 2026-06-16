"use client"

import * as React from "react"

import {
  SchemaBuilder,
  type ExtendedJSONSchema7,
} from "@/components/ui/schema-builder"

import { schemaWithDefs } from "./schema-builder-example-shared"

export function SchemaBuilderDefinitions() {
  const [schema, setSchema] =
    React.useState<ExtendedJSONSchema7>(schemaWithDefs)

  return (
    <div className="rounded-xl border bg-card p-3 shadow-sm">
      <SchemaBuilder
        value={schema}
        onValueChange={setSchema}
        features={{
          definitions: true,
          objectTemplates: true,
          jsonMode: true,
          importExport: true,
        }}
      />
    </div>
  )
}
