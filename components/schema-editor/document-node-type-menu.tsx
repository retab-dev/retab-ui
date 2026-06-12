"use client"

import * as React from "react"
import type { JSONSchema7Definition } from "json-schema"
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

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { SchemaEditorType } from "@/components/schema-editor/document/type-operations"
import type { ResolvedSchemaBuilderFeatures } from "@/components/schema-editor/schema-builder-types"
import {
  getTemplateIcon,
  getTypeIcon,
} from "@/components/schema-editor/type-icons"

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
          className="w-40 justify-between pr-1 pl-2 text-xs font-normal text-muted-foreground"
        >
          <div className="flex items-center gap-1">
            {localType === "$ref" && refName
              ? getTemplateIcon(refName)
              : getTypeIcon(localType)}
            <span>{typeLabel(localType, refName)}</span>
          </div>
          <ChevronDown className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onClick={() => onSelectType("string")}>
          <Type className="h-4 w-4" />
          string
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onSelectType("number")}>
          <Hash className="h-4 w-4" />
          number
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onSelectType("integer")}>
          <Hash className="h-4 w-4" />
          integer
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onSelectType("boolean")}>
          <ToggleLeft className="h-4 w-4" />
          true/false
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onSelectType("enum")}>
          <List className="h-4 w-4" />
          multiple choice
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onSelectType("object")}>
          <Braces className="h-4 w-4" />
          object
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onSelectType("array")}>
          <Brackets className="h-4 w-4" />
          list
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onSelectType("date")}>
          <Calendar className="h-4 w-4" />
          date
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onSelectType("time")}>
          <Clock className="h-4 w-4" />
          time
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onSelectType("datetime")}>
          <CalendarClock className="h-4 w-4" />
          datetime
        </DropdownMenuItem>

        {features.definitions && (
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <Link className="h-4 w-4" />
              definition
            </DropdownMenuSubTrigger>
            <DropdownMenuPortal>
              <DropdownMenuSubContent>
                {Object.keys(defs).length === 0 ? (
                  <DropdownMenuItem onClick={onCreateDefinition}>
                    <PlusIcon className="h-4 w-4" />
                    Create a new definition to get started
                  </DropdownMenuItem>
                ) : (
                  Object.keys(defs).map((definitionName) => (
                    <DropdownMenuItem
                      key={definitionName}
                      onClick={() => onSelectDefinition(definitionName)}
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
            <LazyObjectTemplateSubmenu
              onSelectTemplate={onSelectObjectTemplate}
            />
          </React.Suspense>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
