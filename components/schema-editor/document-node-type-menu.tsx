"use client"

import * as React from "react"
import {
  Braces,
  Brackets,
  Calendar,
  CalendarClock,
  ChevronDown,
  Clock,
  Hash,
  Link,
  List,
  PlusIcon,
  ToggleLeft,
  Type,
} from "lucide-react"
import type { JSONSchema7Definition } from "json-schema"

import type { SchemaEditorType } from "@/components/schema-editor/document"
import {
  getTemplateIcon,
  getTypeIcon,
} from "@/components/schema-editor/type-icons"
import type { ResolvedSchemaBuilderFeatures } from "@/components/schema-editor/schema-builder-types"
import { Button } from "@/components/ui-retab/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui-retab/dropdown-menu"

const LazyObjectTemplateSubmenu = React.lazy(() =>
  import("./optional/object-templates/object-template-menu").then((module) => ({
    default: module.ObjectTemplateSubmenu,
  }))
)

function typeLabel(type: string, refName?: string) {
  if (type === "$ref" && refName) return refName
  if (type === "boolean") return "true/false"
  if (type === "enum") return "multiple choice"
  if (type === "array") return "list"
  return type || "Select type"
}

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
  if (!isEditable) {
    return (
      <div className="ml-4 w-40 text-xs">
        {typeLabel(localType, refName) || "string"}
      </div>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="w-40 justify-between pr-0 text-xs font-normal text-muted-foreground"
        >
          <div className="flex items-center gap-1">
            {localType === "$ref" && refName
              ? getTemplateIcon(refName)
              : getTypeIcon(localType)}
            <span>{typeLabel(localType, refName)}</span>
          </div>
          <ChevronDown className="mx-2 h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onSelect={() => onSelectType("string")}>
          <Type className="mr-2 h-4 w-4" />
          string
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onSelectType("number")}>
          <Hash className="mr-2 h-4 w-4" />
          number
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onSelectType("integer")}>
          <Hash className="mr-2 h-4 w-4" />
          integer
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onSelectType("boolean")}>
          <ToggleLeft className="mr-2 h-4 w-4" />
          true/false
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onSelectType("enum")}>
          <List className="mr-2 h-4 w-4" />
          multiple choice
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onSelectType("object")}>
          <Braces className="mr-2 h-4 w-4" />
          object
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onSelectType("array")}>
          <Brackets className="mr-2 h-4 w-4" />
          list
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onSelectType("date")}>
          <Calendar className="mr-2 h-4 w-4" />
          date
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onSelectType("time")}>
          <Clock className="mr-2 h-4 w-4" />
          time
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onSelectType("datetime")}>
          <CalendarClock className="mr-2 h-4 w-4" />
          datetime
        </DropdownMenuItem>

        {features.definitions && (
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <Link className="mr-4 h-4 w-4" />
              definition
            </DropdownMenuSubTrigger>
            <DropdownMenuPortal>
              <DropdownMenuSubContent>
                {Object.keys(defs).length === 0 ? (
                  <DropdownMenuItem onSelect={onCreateDefinition}>
                    <PlusIcon className="mr-2 h-4 w-4" />
                    Create a new definition to get started
                  </DropdownMenuItem>
                ) : (
                  Object.keys(defs).map((definitionName) => (
                    <DropdownMenuItem
                      key={definitionName}
                      onSelect={() => onSelectDefinition(definitionName)}
                    >
                      {getTemplateIcon(definitionName)}
                      {definitionName}
                    </DropdownMenuItem>
                  ))
                )}
              </DropdownMenuSubContent>
            </DropdownMenuPortal>
          </DropdownMenuSub>
        )}
        {features.objectTemplates && (
          <React.Suspense fallback={null}>
            <LazyObjectTemplateSubmenu onSelectTemplate={onSelectObjectTemplate} />
          </React.Suspense>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
