"use client"

import type { JSONSchema7Definition } from "json-schema"

import type { SchemaEditorType } from "@/components/schema-editor/document/type-operations"
import { SchemaTypeMenu } from "@/components/schema-editor/primitives/schema-type-menu"
import type { ResolvedSchemaBuilderFeatures } from "@/components/schema-editor/schema-builder-types"

interface DocumentNodeTypeMenuProps {
  defs: Record<string, JSONSchema7Definition>
  features: ResolvedSchemaBuilderFeatures
  isEditable: boolean
  localType: string
  refName?: string
  onCreateDefinition: () => void
  onSelectDefinition: (definitionName: string) => void
  onSelectObjectTemplate: (templateName: string) => void
  onSelectType: (type: SchemaEditorType | "enum") => void
}

export function DocumentNodeTypeMenu({
  defs,
  features,
  isEditable,
  localType,
  refName,
  onCreateDefinition,
  onSelectDefinition,
  onSelectObjectTemplate,
  onSelectType,
}: DocumentNodeTypeMenuProps) {
  return (
    <SchemaTypeMenu
      variant="row"
      defs={defs}
      definitionsEnabled={features.definitions}
      definitionCreateLabel="Create a new definition to get started"
      isEditable={isEditable}
      localType={localType}
      objectTemplatesEnabled={features.objectTemplates}
      refName={refName}
      onCreateDefinition={onCreateDefinition}
      onSelectDefinition={onSelectDefinition}
      onSelectObjectTemplate={onSelectObjectTemplate}
      onSelectType={onSelectType}
    />
  )
}
