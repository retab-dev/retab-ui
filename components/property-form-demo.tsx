"use client"

import * as React from "react"

import { type ExtendedJSONSchema7 } from "@/components/schema-editor/lib/json-schema-types"
import { PropertyForm } from "@/components/schema-editor/property-form/property-form"

export function PropertyFormDemo() {
  const [property, setProperty] = React.useState<ExtendedJSONSchema7>({
    type: "object",
    description: "",
    properties: {
      street: { type: "string" },
      city: { type: "string" },
    },
    required: ["street"],
  })
  const [name, setName] = React.useState("address")

  return (
    <div className="not-prose max-w-xl overflow-hidden rounded-xl border bg-card">
      <PropertyForm
        propertyDraft={{ name, schemaNode: property }}
        schemaContext={{
          siblingNames: [],
          originalName: name,
          schemaDefinitions: {},
        }}
        submitLabel="Save"
        onCommitPropertyDraft={(next) => {
          setName(next.name)
          setProperty(next.schemaNode)
        }}
        onCancel={() => {}}
        onDelete={() => {}}
      />
    </div>
  )
}
