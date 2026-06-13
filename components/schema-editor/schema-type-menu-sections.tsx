"use client"

import { PlusIcon } from "lucide-react"

import type {
  SchemaTypeMenuItem,
  SchemaTypeMenuSection,
  SchemaTypeMenuValue,
} from "@/components/schema-editor/primitives/schema-type-menu"
import {
  schemaTypeIcon,
  schemaTypeLabel,
  schemaTypeOptions,
  type SchemaTypeOptionId,
} from "@/components/schema-editor/primitives/schema-type-options"
import {
  getTemplateIcon,
  getTypeIcon,
} from "@/components/schema-editor/type-icons"

export function createTypeMenuValue({
  type,
  refName,
}: {
  type: string
  refName?: string
}): SchemaTypeMenuValue {
  return {
    id: type,
    label: schemaTypeLabel(type, refName),
    icon: schemaTypeIcon(type, refName),
  }
}

export function createPrimitiveTypeItems({
  onSelectType,
}: {
  onSelectType: (type: SchemaTypeOptionId) => void
}): SchemaTypeMenuItem[] {
  return schemaTypeOptions.map((option) => ({
    id: option.id,
    label: option.label,
    icon: option.icon,
    onSelect: () => onSelectType(option.id),
  }))
}

export function createDefinitionTypeSubmenu({
  createDefinitionLabel,
  definitionNames,
  onCreateDefinition,
  onSelectDefinition,
}: {
  createDefinitionLabel: string
  definitionNames: string[]
  onCreateDefinition: () => void
  onSelectDefinition: (definitionName: string) => void
}): SchemaTypeMenuSection {
  return {
    id: "definitions",
    kind: "submenu",
    label: "definition",
    icon: getTypeIcon("$ref"),
    items:
      definitionNames.length === 0
        ? [
            {
              id: "create-definition",
              label: createDefinitionLabel,
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
  }
}
