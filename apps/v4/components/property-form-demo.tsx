"use client"

import * as React from "react"

import { PropertyForm } from "@/components/schema-editor/property-form"
import { JsonSchemaEditorProvider } from "@/components/schema-editor/contexts/json-schema"
import { type ExtendedJSONSchema7 } from "@/components/schema-editor/lib/json-schema-types"

export function PropertyFormDemo() {
  const [property, setProperty] = React.useState<ExtendedJSONSchema7>({
    type: "string",
    enum: ["USD", "EUR", "GBP"],
    description: "",
  })
  const [name, setName] = React.useState("currency")
  const [schema, setSchema] = React.useState<ExtendedJSONSchema7>({
    type: "object",
    properties: {},
    $defs: {},
  })

  return (
    <div className="not-prose max-w-xl overflow-hidden rounded-xl border bg-card">
      <JsonSchemaEditorProvider jsonSchema={schema} setJsonSchema={setSchema}>
        <PropertyForm
          editedProperty={property}
          setEditedProperty={setProperty}
          setJsonSchema={setSchema}
          editedJsonSchema={schema}
          setEditedJsonSchema={setSchema}
          editedName={name}
          setEditedName={setName}
          submitLabel="Save"
          onSubmit={() => {}}
          onCancel={() => {}}
          onDelete={() => {}}
        />
      </JsonSchemaEditorProvider>
    </div>
  )
}
