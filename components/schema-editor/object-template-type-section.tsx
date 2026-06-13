"use client"

import * as React from "react"

import type { SchemaTypeMenuAccessory } from "@/components/schema-editor/primitives/schema-type-menu"

const LazyObjectTemplateSubmenu = React.lazy(() =>
  import(
    "@/components/schema-editor/optional/object-templates/object-template-menu"
  ).then((module) => ({
    default: module.ObjectTemplateSubmenu,
  }))
)

export function createObjectTemplateTypeAccessory({
  onSelectTemplate,
}: {
  onSelectTemplate: (templateName: string) => void
}): SchemaTypeMenuAccessory {
  function ObjectTemplateTypeAccessory({ editable }: { editable: boolean }) {
    return (
      <React.Suspense fallback={null}>
        <LazyObjectTemplateSubmenu
          onSelectTemplate={(templateName) => {
            if (!editable) return
            onSelectTemplate(templateName)
          }}
        />
      </React.Suspense>
    )
  }

  ObjectTemplateTypeAccessory.displayName = "ObjectTemplateTypeAccessory"
  return ObjectTemplateTypeAccessory
}
