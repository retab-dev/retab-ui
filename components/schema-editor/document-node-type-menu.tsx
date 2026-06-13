"use client"

import * as React from "react"
import type { JSONSchema7Definition } from "json-schema"
import { PlusIcon } from "lucide-react"

import type { SchemaEditorType } from "@/components/schema-editor/document/type-operations"
import {
  SchemaTypeMenu,
  type SchemaTypeMenuSection,
} from "@/components/schema-editor/primitives/schema-type-menu"
import {
  schemaTypeIcon,
  schemaTypeLabel,
  schemaTypeOptions,
} from "@/components/schema-editor/primitives/schema-type-options"
import type { ResolvedSchemaBuilderFeatures } from "@/components/schema-editor/schema-builder-types"
import {
  getTemplateIcon,
  getTypeIcon,
} from "@/components/schema-editor/type-icons"

const LazyObjectTemplateSubmenu = React.lazy(() =>
  import(
    "@/components/schema-editor/optional/object-templates/object-template-menu"
  ).then((module) => ({
    default: module.ObjectTemplateSubmenu,
  }))
)

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
  const definitionNames = Object.keys(defs)
  const sections: SchemaTypeMenuSection[] = [
    {
      id: "types",
      kind: "items",
      items: schemaTypeOptions.map((option) => ({
        id: option.id,
        label: option.label,
        icon: option.icon,
        onSelect: () => onSelectType(option.id as SchemaEditorType | "enum"),
      })),
    },
  ]

  if (features.definitions) {
    sections.push({
      id: "definitions",
      kind: "submenu",
      label: "definition",
      icon: getTypeIcon("$ref"),
      items:
        definitionNames.length === 0
          ? [
              {
                id: "create-definition",
                label: "Create a new definition to get started",
                icon: <PlusIcon className="h-4 w-4" />,
                onSelect: onCreateDefinition,
              },
            ]
          : definitionNames.map((definitionName) => ({
              id: definitionName,
              label: definitionName,
              icon: getTemplateIcon(definitionName),
              onSelect: () => onSelectDefinition(definitionName),
            })),
    })
  }

  if (features.objectTemplates) {
    sections.push({
      id: "object-templates",
      kind: "custom",
      render: ({ editable }) => (
        <React.Suspense fallback={null}>
          <LazyObjectTemplateSubmenu
            onSelectTemplate={(templateName) => {
              if (!editable) return
              onSelectObjectTemplate(templateName)
            }}
          />
        </React.Suspense>
      ),
    })
  }

  return (
    <SchemaTypeMenu
      variant="row"
      editable={isEditable}
      sections={sections}
      value={{
        id: localType,
        label: schemaTypeLabel(localType, refName),
        icon: schemaTypeIcon(localType, refName),
      }}
    />
  )
}
