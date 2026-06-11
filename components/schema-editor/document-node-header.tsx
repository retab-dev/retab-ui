"use client"

import * as React from "react"
import { useState } from "react"
import type { JSONSchema7Type } from "json-schema"
import {
  AlertCircle,
  Braces,
  Brackets,
  Calendar,
  CalendarClock,
  ChevronDown,
  Clock,
  Eye,
  EyeIcon,
  GripVertical,
  Hash,
  Link,
  List,
  Pencil,
  PlusIcon,
  ToggleLeft,
  Trash2,
  Type,
} from "lucide-react"

import {
  setEnumValues,
  setNodeDescription,
  setNodeEditorType,
  setRefByName,
  type SchemaEditorType,
} from "@/components/schema-editor/document"
import type { ExtendedJSONSchema7 } from "@/components/schema-editor/lib/json-schema-types"
import { validateName } from "@/components/schema-editor/lib/json-schema-utils"
import { NodeDialog } from "@/components/schema-editor/node-dialog"
import {
  getTemplateIcon,
  getTypeIcon,
} from "@/components/schema-editor/type-icons"
import type {
  DocumentSchemaNodeEditorProps,
  SchemaEditorMode,
} from "@/components/schema-editor/document-node-editor-types"
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
import { Input } from "@/components/ui-retab/input"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui-retab/tooltip"

import { EnumCreationDialog } from "./enum-creation-dialog"
import { getEffectiveType } from "./draft/draft-node-edits"

const LazyObjectTemplateSubmenu = React.lazy(() =>
  import("./optional/object-templates/object-template-menu").then((module) => ({
    default: module.ObjectTemplateSubmenu,
  }))
)

function typeLabel(type: string, ref?: string) {
  if (type === "$ref" && ref) return ref.replace("#/$defs/", "")
  if (type === "boolean") return "true/false"
  if (type === "enum") return "multiple choice"
  if (type === "array") return "list"
  return type || "Select type"
}

interface DocumentNodeHeaderProps
  extends Omit<
    DocumentSchemaNodeEditorProps,
    "doc" | "draggedParentRef" | "draggedPropertyRef"
  > {
  effective: ExtendedJSONSchema7
  editMode: SchemaEditorMode
  features: NonNullable<DocumentSchemaNodeEditorProps["features"]>
  localType: string
  onChange: (newNode: ExtendedJSONSchema7) => void
}

export function DocumentNodeHeader({
  applyDocOp,
  name,
  node,
  nodeId,
  path,
  defs,
  canDelete = false,
  onDelete,
  onNameChange,
  setDefsAccordionOpen,
  editMode,
  hidePencilButton = false,
  siblingNames = [],
  features,
  effective,
  localType,
  onChange,
}: DocumentNodeHeaderProps) {
  const isEditable = editMode === "editable"
  const description = node.description || ""

  const [metadataDialogOpen, setMetadataDialogOpen] = useState(false)
  const [enumCreationDialogOpen, setEnumCreationDialogOpen] = useState(false)
  const [isEditingPropertyName, setIsEditingPropertyName] = useState(false)
  const [editedPropertyName, setEditedPropertyName] = useState(name)
  const [propInlineErr, setPropInlineErr] = useState<string | null>(null)
  const [isEditingDescription, setIsEditingDescription] = useState(false)
  const [editedDescription, setEditedDescription] = useState(description)

  const validateInline = (value: string) =>
    validateName(value, siblingNames, name, "property")

  const handleTypeChange = (newType: string) => {
    if (newType === "enum") {
      if (localType !== "enum") {
        setEnumCreationDialogOpen(true)
      }
      return
    }
    applyDocOp((current) =>
      setNodeEditorType(current, nodeId, newType as SchemaEditorType)
    )
  }

  const handleEnumConfirm = (enumValues: string[]) => {
    applyDocOp((current) => setEnumValues(current, nodeId, enumValues))
  }

  const handlePropertyNameSubmit = () => {
    const err = validateInline(editedPropertyName)
    if (err) {
      setPropInlineErr(err)
      return
    }

    setPropInlineErr(null)
    if (editedPropertyName && editedPropertyName !== name && onNameChange) {
      onNameChange(editedPropertyName)
    }
    setIsEditingPropertyName(false)
  }

  const handleDescriptionSubmit = () => {
    const trimmedValue = editedDescription.trim()
    if (trimmedValue === description.trim()) {
      setIsEditingDescription(false)
      return
    }

    applyDocOp((current) =>
      setNodeDescription(current, nodeId, trimmedValue || undefined)
    )
    setIsEditingDescription(false)
  }

  const handlePropertyFormCommand = React.useCallback<
    NonNullable<React.ComponentProps<typeof NodeDialog>["formContext"]["onCommand"]>
  >(
    async (command) => {
      if (command.type === "createDefinition") {
        setDefsAccordionOpen(true)
        return
      }

      if (command.type === "installObjectTemplate") {
        const { addObjectTemplateDefinitionsToDocument } = await import(
          "./optional/object-templates/object-template-reference"
        )
        applyDocOp((current) =>
          addObjectTemplateDefinitionsToDocument(current, command.templateName)
        )
      }
    },
    [applyDocOp, setDefsAccordionOpen]
  )

  const refName =
    localType === "$ref" && effective.$ref
      ? effective.$ref.replace("#/$defs/", "")
      : undefined

  return (
    <>
      {path !== "#" && (
        <div
          id={`schema-field-${path.replace(/^#\.?/, "").split(".").join("-")}`}
          className="group flex flex-col items-start justify-between py-0 pl-0 hover:bg-accent sm:flex-row sm:items-center"
        >
          {isEditable ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <GripVertical className="h-12 w-6 cursor-pointer px-1 py-4 text-transparent group-hover:text-muted-foreground" />
              </TooltipTrigger>
            </Tooltip>
          ) : (
            <div className="h-12 w-6 px-1 py-4" />
          )}

          <div className="flex min-w-0 flex-1 items-center space-x-2">
            {isEditingPropertyName && isEditable ? (
              <Input
                className={`m-0 h-6 w-40 border-none p-0 px-1 text-sm font-medium shadow-none outline-none focus-visible:ring-0 ${propInlineErr ? "border-destructive" : ""}`}
                value={editedPropertyName}
                onChange={(event) => {
                  const value = event.target.value
                  setEditedPropertyName(value)
                  setPropInlineErr(value ? validateInline(value) : null)
                }}
                onBlur={handlePropertyNameSubmit}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    handlePropertyNameSubmit()
                  }
                }}
                autoFocus
              />
            ) : (
              <div className="flex items-center">
                <span
                  className="mr-1 cursor-pointer text-sm font-medium whitespace-nowrap text-foreground"
                  onClick={() => {
                    if (onNameChange) {
                      setEditedPropertyName(name)
                      setPropInlineErr(null)
                      setIsEditingPropertyName(true)
                    }
                  }}
                >
                  {name}
                </span>
                {localType === "$ref" && effective.$ref && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-4 w-4 p-0"
                    onClick={() => {
                      const defName = effective.$ref?.replace("#/$defs/", "")
                      setDefsAccordionOpen(true)
                      setTimeout(() => {
                        const defElement = document.getElementById(
                          `def-${defName}`
                        )
                        if (defElement) {
                          defElement.scrollIntoView({ behavior: "smooth" })
                          defElement.classList.add("bg-accent")
                          setTimeout(
                            () => defElement.classList.remove("bg-accent"),
                            2500
                          )
                        }
                      }, 600)
                    }}
                  >
                    <EyeIcon className="h-4 w-4 text-muted-foreground" />
                  </Button>
                )}
              </div>
            )}
            {isEditingPropertyName && propInlineErr && (
              <p className="mt-1 ml-1 flex items-center gap-1 text-xs text-destructive">
                <AlertCircle className="h-3 w-3" /> {propInlineErr}
              </p>
            )}
            <div className="flex min-w-0 flex-1 items-center gap-1">
              {isEditingDescription && editMode !== "readOnly" ? (
                <Input
                  className="m-0 h-6 border-none p-0 px-1 !text-xs shadow-none outline-none focus-visible:ring-0"
                  value={editedDescription}
                  placeholder="Add description"
                  onChange={(event) => setEditedDescription(event.target.value)}
                  onBlur={handleDescriptionSubmit}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      handleDescriptionSubmit()
                    } else if (event.key === "Escape") {
                      setEditedDescription(description)
                      setIsEditingDescription(false)
                    }
                  }}
                  autoFocus
                />
              ) : (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div
                      className={`flex h-6 min-w-[140px] flex-1 items-center truncate rounded-sm px-1 !text-xs ${
                        editMode === "readOnly"
                          ? "text-muted-foreground"
                          : "cursor-text text-muted-foreground hover:bg-accent hover:text-foreground"
                      }`}
                      onClick={() => {
                        if (editMode === "readOnly") {
                          setMetadataDialogOpen(true)
                          return
                        }
                        setEditedDescription(description)
                        setIsEditingDescription(true)
                      }}
                    >
                      {description || (
                        <span className="text-muted-foreground/70">
                          Add description
                        </span>
                      )}
                    </div>
                  </TooltipTrigger>

                  {description && (
                    <TooltipContent className="max-w-xs">
                      <div className="mb-1 text-xs text-muted-foreground">
                        Description:
                      </div>
                      <div className="text-xs">{description}</div>
                    </TooltipContent>
                  )}
                </Tooltip>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isEditable && canDelete && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="m-0 h-3 w-3 p-0"
                onClick={onDelete}
              >
                <Trash2 className="h-1 w-1 text-primary-foreground group-hover:text-muted-foreground" />
              </Button>
            )}

            {!hidePencilButton && editMode !== "readOnly" && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="m-0 p-0"
                    onClick={() => setMetadataDialogOpen(true)}
                  >
                    <Pencil className="h-1 w-1 text-muted-foreground opacity-0 group-hover:opacity-100" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p>Edit field properties</p>
                </TooltipContent>
              </Tooltip>
            )}

            {editMode === "readOnly" && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="m-0 p-0"
                    onClick={() => setMetadataDialogOpen(true)}
                  >
                    <Eye className="h-1 w-1 text-muted-foreground opacity-0 group-hover:opacity-100" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p>View field properties</p>
                </TooltipContent>
              </Tooltip>
            )}

            {isEditable ? (
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
                      <span>{typeLabel(localType, effective.$ref)}</span>
                    </div>
                    <ChevronDown className="mx-2 h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onSelect={() => handleTypeChange("string")}>
                    <Type className="mr-2 h-4 w-4" />
                    string
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => handleTypeChange("number")}>
                    <Hash className="mr-2 h-4 w-4" />
                    number
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() => handleTypeChange("integer")}
                  >
                    <Hash className="mr-2 h-4 w-4" />
                    integer
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() => handleTypeChange("boolean")}
                  >
                    <ToggleLeft className="mr-2 h-4 w-4" />
                    true/false
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => handleTypeChange("enum")}>
                    <List className="mr-2 h-4 w-4" />
                    multiple choice
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => handleTypeChange("object")}>
                    <Braces className="mr-2 h-4 w-4" />
                    object
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => handleTypeChange("array")}>
                    <Brackets className="mr-2 h-4 w-4" />
                    list
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => handleTypeChange("date")}>
                    <Calendar className="mr-2 h-4 w-4" />
                    date
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => handleTypeChange("time")}>
                    <Clock className="mr-2 h-4 w-4" />
                    time
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() => handleTypeChange("datetime")}
                  >
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
                          {!defs || Object.keys(defs).length === 0 ? (
                            <DropdownMenuItem
                              onSelect={() => {
                                setDefsAccordionOpen(true)
                                setTimeout(() => {
                                  const defsSection = document.getElementById(
                                    "definitions-section"
                                  )
                                  if (defsSection) {
                                    defsSection.scrollIntoView({
                                      behavior: "smooth",
                                    })
                                    defsSection.style.backgroundColor =
                                      "var(--accent)"
                                    setTimeout(() => {
                                      defsSection.style.backgroundColor = ""
                                    }, 2500)
                                  }
                                }, 600)
                              }}
                            >
                              <PlusIcon className="mr-2 h-4 w-4" />
                              Create a new definition to get started
                            </DropdownMenuItem>
                          ) : (
                            Object.keys(defs).map((defKey) => (
                              <DropdownMenuItem
                                key={defKey}
                                onSelect={() => {
                                  applyDocOp((current) =>
                                    setRefByName(current, nodeId, defKey)
                                  )
                                }}
                              >
                                {getTemplateIcon(defKey)}
                                {defKey}
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
                        onSelectTemplate={(templateName) => {
                          void import(
                            "./optional/object-templates/object-template-reference"
                          ).then(({ applyObjectTemplateReferenceToDocument }) => {
                            applyDocOp((current) =>
                              applyObjectTemplateReferenceToDocument(
                                current,
                                nodeId,
                                templateName
                              )
                            )
                          })
                        }}
                      />
                    </React.Suspense>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <div className="ml-4 w-40 text-xs">
                {typeLabel(localType, effective.$ref) || "string"}
              </div>
            )}
          </div>
        </div>
      )}

      {path !== "#" && metadataDialogOpen ? (
        <NodeDialog
          isOpen={metadataDialogOpen}
          onClose={() => setMetadataDialogOpen(false)}
          onChange={onChange}
          onNameChange={onNameChange || (() => {})}
          onDelete={
            isEditable && canDelete
              ? () => {
                  if (onDelete) {
                    onDelete()
                    setMetadataDialogOpen(false)
                  }
                }
              : undefined
          }
          node={node}
          name={name}
          editMode={editMode}
          siblingNames={siblingNames}
          formContext={{
            schemaDefinitions: defs || {},
            fieldPath: path,
            objectTemplatesEnabled: features.objectTemplates,
            onCommand: handlePropertyFormCommand,
          }}
        />
      ) : null}

      <EnumCreationDialog
        isOpen={enumCreationDialogOpen}
        onClose={() => setEnumCreationDialogOpen(false)}
        onConfirm={handleEnumConfirm}
        onCancel={() => undefined}
      />
    </>
  )
}
