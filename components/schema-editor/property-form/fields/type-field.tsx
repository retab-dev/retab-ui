"use client"

import * as React from "react"
import { ChevronDown, PlusIcon } from "lucide-react"

import {
  getEffectiveType,
  updateEffectiveNode,
  updateType,
} from "@/components/schema-editor/draft/draft-node-edits"
import type { ExtendedJSONSchema7 } from "@/components/schema-editor/lib/json-schema-types"
import { getEffectiveNode } from "@/components/schema-editor/lib/json-schema-utils"
import type { PropertyFormSchemaContext } from "@/components/schema-editor/property-form/types"
import {
  getTemplateIcon,
  getTypeIcon,
} from "@/components/schema-editor/type-icons"
import { Button } from "@/components/ui-retab/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui-retab/dropdown-menu"

const LazyObjectTemplateSubmenu = React.lazy(() =>
  import("@/components/schema-editor/optional/object-templates/object-template-menu").then(
    (module) => ({
      default: module.ObjectTemplateSubmenu,
    })
  )
)

const primitiveTypes = [
  ["string", "string"],
  ["number", "number"],
  ["integer", "integer"],
  ["boolean", "true/false"],
  ["enum", "multiple choice"],
  ["date", "date"],
  ["time", "time"],
  ["datetime", "timestamp"],
  ["array", "list"],
  ["object", "object"],
] as const

function typeLabel(type: string, node: ExtendedJSONSchema7) {
  if (type === "$ref") {
    const ref = node.$ref
    return ref ? ref.replace("#/$defs/", "") : "$ref"
  }
  if (type === "datetime") return "timestamp"
  if (type === "boolean") return "true/false"
  if (type === "enum") return "multiple choice"
  if (type === "array") return "list"
  return type
}

export function TypeField({
  schemaNode,
  schemaContext,
  fieldPath,
  mode,
  disabled,
  onChange,
}: {
  schemaNode: ExtendedJSONSchema7
  schemaContext: PropertyFormSchemaContext
  fieldPath?: string
  mode: "descriptionOnly" | "readOnly" | "editable"
  disabled: boolean
  onChange: (schemaNode: ExtendedJSONSchema7) => void
}) {
  const effectiveType = getEffectiveType(schemaNode)
  const effectiveSchemaNode = getEffectiveNode(schemaNode)
  const definitionNames = Object.keys(schemaContext.schemaDefinitions)
  const isDisabled = disabled || mode === "readOnly"

  const setType = (type: (typeof primitiveTypes)[number][0]) => {
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
    void schemaContext.onCommand?.({
      type: "selectDefinition",
      definitionName,
    })
    onChange(
      updateEffectiveNode(
        schemaNode,
        withReplacementMetadata({
          $ref: `#/$defs/${definitionName}`,
        })
      )
    )
  }

  const setObjectTemplate = (templateName: string) => {
    void schemaContext.onCommand?.({
      type: "installObjectTemplate",
      templateName,
    })
    onChange(
      updateEffectiveNode(
        schemaNode,
        withReplacementMetadata({
          $ref: `#/$defs/${templateName}`,
        })
      )
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          aria-label={`Data type${fieldPath ? ` for ${fieldPath}` : ""}`}
          disabled={isDisabled}
          variant="outline"
          className={`mt-2 w-full justify-between ${isDisabled ? "disabled:opacity-100" : ""}`}
        >
          <div className="flex items-center gap-2">
            {effectiveType.type === "$ref" && effectiveSchemaNode.$ref
              ? getTemplateIcon(
                  effectiveSchemaNode.$ref.replace("#/$defs/", "")
                )
              : getTypeIcon(effectiveType.type)}
            <span>{typeLabel(effectiveType.type, effectiveSchemaNode)}</span>
          </div>
          <ChevronDown className="ml-2 h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-full">
        {primitiveTypes.map(([type, label]) => (
          <DropdownMenuItem
            key={type}
            disabled={isDisabled}
            onSelect={() => setType(type)}
          >
            <div className="flex items-center gap-2">
              {getTypeIcon(type)}
              <span>{label}</span>
            </div>
          </DropdownMenuItem>
        ))}

        <DropdownMenuSub>
          <DropdownMenuSubTrigger disabled={isDisabled}>
            <div className="flex items-center gap-2">
              {getTypeIcon("$ref")}
              <span>definition</span>
            </div>
          </DropdownMenuSubTrigger>
          <DropdownMenuPortal>
            <DropdownMenuSubContent>
              {definitionNames.map((definitionName) => (
                <DropdownMenuItem
                  key={definitionName}
                  onSelect={() => setDefinition(definitionName)}
                >
                  <div className="flex items-center gap-2">
                    {getTemplateIcon(definitionName)}
                    <span>{definitionName}</span>
                  </div>
                </DropdownMenuItem>
              ))}
              {definitionNames.length > 0 ? <DropdownMenuSeparator /> : null}
              <DropdownMenuItem
                disabled={isDisabled}
                onSelect={() => {
                  void schemaContext.onCommand?.({ type: "createDefinition" })
                }}
              >
                <div className="flex items-center gap-2">
                  <PlusIcon className="h-4 w-4" />
                  <span>Create new definition</span>
                </div>
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuPortal>
        </DropdownMenuSub>

        {schemaContext.objectTemplatesEnabled && !isDisabled && (
          <React.Suspense fallback={null}>
            <LazyObjectTemplateSubmenu onSelectTemplate={setObjectTemplate} />
          </React.Suspense>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
