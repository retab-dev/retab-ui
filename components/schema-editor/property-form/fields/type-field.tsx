"use client"

import * as React from "react"
import { PlusIcon } from "lucide-react"

import {
  definitionNameFromRef,
  definitionRef,
} from "@/components/schema-editor/document/json-pointer"
import {
  getEffectiveType,
  updateEffectiveNode,
  updateType,
} from "@/components/schema-editor/draft/draft-node-edits"
import type { ExtendedJSONSchema7 } from "@/components/schema-editor/lib/json-schema-types"
import { getEffectiveNode } from "@/components/schema-editor/lib/json-schema-utils"
import {
  SchemaTypeMenu,
  type SchemaTypeMenuSection,
} from "@/components/schema-editor/primitives/schema-type-menu"
import {
  schemaTypeIcon,
  schemaTypeLabel,
  schemaTypeOptions,
  type SchemaTypeOptionId,
} from "@/components/schema-editor/primitives/schema-type-options"
import type { PropertyFormSchemaContext } from "@/components/schema-editor/property-form/types"
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

export function TypeField({
  schemaNode,
  schemaContext,
  fieldPath,
  mode,
  disabled,
  variant = "outline",
  onChange,
}: {
  schemaNode: ExtendedJSONSchema7
  schemaContext: PropertyFormSchemaContext
  fieldPath?: string
  mode: "descriptionOnly" | "readOnly" | "editable"
  disabled: boolean
  variant?: "outline" | "compact"
  onChange: (schemaNode: ExtendedJSONSchema7) => void
}) {
  const effectiveType = getEffectiveType(schemaNode)
  const effectiveSchemaNode = getEffectiveNode(schemaNode)
  const isDisabled = disabled || mode === "readOnly"

  const setType = (type: SchemaTypeOptionId) => {
    if (isDisabled) return
    const nextSchemaNode = updateType(
      type,
      effectiveType.isNullable,
      schemaNode
    )
    onChange(nextSchemaNode)
  }

  const withReplacementMetadata = (
    replacement: ExtendedJSONSchema7
  ): ExtendedJSONSchema7 => {
    if (schemaNode.anyOf && Array.isArray(schemaNode.anyOf)) return replacement
    return {
      ...replacement,
      ...(schemaNode.title ? { title: schemaNode.title } : {}),
      ...(schemaNode.description
        ? { description: schemaNode.description }
        : {}),
    }
  }

  const setDefinition = (definitionName: string) => {
    if (isDisabled) return
    void schemaContext.onCommand?.({
      type: "selectDefinition",
      definitionName,
    })
    onChange(
      updateEffectiveNode(
        schemaNode,
        withReplacementMetadata({
          $ref: definitionRef("$defs", definitionName),
        })
      )
    )
  }

  const setObjectTemplate = (templateName: string) => {
    if (isDisabled) return
    void schemaContext.onCommand?.({
      type: "installObjectTemplate",
      templateName,
    })
    onChange(
      updateEffectiveNode(
        schemaNode,
        withReplacementMetadata({
          $ref: definitionRef("$defs", templateName),
        })
      )
    )
  }

  const refName =
    effectiveType.type === "$ref" && effectiveSchemaNode.$ref
      ? definitionNameFromRef(effectiveSchemaNode.$ref)
      : undefined
  const definitionNames = Object.keys(schemaContext.schemaDefinitions)
  const sections: SchemaTypeMenuSection[] = [
    {
      id: "types",
      kind: "items",
      items: schemaTypeOptions.map((option) => ({
        id: option.id,
        label: option.label,
        icon: option.icon,
        onSelect: () => setType(option.id),
      })),
    },
    {
      id: "definitions",
      kind: "submenu",
      label: "definition",
      icon: getTypeIcon("$ref"),
      items:
        definitionNames.length === 0
          ? [
              {
                id: "create-definition",
                label: "Create new definition",
                icon: <PlusIcon className="h-4 w-4" />,
                onSelect: () => {
                  if (isDisabled) return
                  void schemaContext.onCommand?.({ type: "createDefinition" })
                },
              },
            ]
          : definitionNames.map((definitionName) => ({
              id: definitionName,
              label: definitionName,
              icon: getTemplateIcon(definitionName),
              onSelect: () => setDefinition(definitionName),
            })),
    },
  ]

  if (schemaContext.objectTemplatesEnabled) {
    sections.push({
      id: "object-templates",
      kind: "custom",
      render: ({ editable }) => (
        <React.Suspense fallback={null}>
          <LazyObjectTemplateSubmenu
            onSelectTemplate={(templateName) => {
              if (!editable) return
              setObjectTemplate(templateName)
            }}
          />
        </React.Suspense>
      ),
    })
  }

  return (
    <SchemaTypeMenu
      ariaLabel={`Data type${fieldPath ? ` for ${fieldPath}` : ""}`}
      editable={!isDisabled}
      sections={sections}
      value={{
        id: effectiveType.type,
        label: schemaTypeLabel(effectiveType.type, refName),
        icon: schemaTypeIcon(effectiveType.type, refName),
      }}
      variant={variant === "compact" ? "row" : "form"}
    />
  )
}
