import React, { useContext, useState } from "react"
import type { JSONSchema7 } from "json-schema"
import {
  Box,
  Calendar,
  CalendarClock,
  CheckSquare,
  ChevronDown,
  ChevronUp,
  Clock,
  Hash,
  List,
  Table,
  Trash2,
  Type,
} from "lucide-react"

import { useMountEffect } from "@/hooks/useMountEffect"
import type { JsonTableHeaderNode } from "@/components/json-table/lib/header-nodes"
import { deleteSchemaProperty } from "@/components/json-table/lib/schema-mutations"
import { getColumnWidthPx } from "@/components/json-table/table-options-store"
import type { ColumnWidth } from "@/components/json-table/table-options-store"
import { useHeaderController } from "@/components/json-table/use-header-controller"
import { JsonSchemaEditorProvider } from "@/components/schema-editor/contexts/json-schema"
import { PropertyEditor } from "@/components/schema-editor/property-dialog"
import { Button } from "@/components/ui-retab/button"
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui-retab/dialog"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui-retab/popover"
import { Separator } from "@/components/ui-retab/separator"

const PopoverDialogContext = React.createContext<boolean>(false)
const PopoverDialog = ({
  isDialog,
  ...props
}: {
  isDialog?: boolean
} & React.ComponentProps<typeof Popover>) => {
  // Always start `false` (the server value) to avoid an SSR/client hydration
  // mismatch; the mount effect below re-measures immediately after hydration.
  const [isBigEnough, setIsBigEnough] = useState<boolean>(false)

  useMountEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null
    let lastRun = 0

    const measureAndUpdate = () => {
      const next = window.innerHeight >= 900
      setIsBigEnough((prev) => (prev !== next ? next : prev))
    }

    const handleResize = () => {
      const now = Date.now()
      const remaining = 1000 - (now - lastRun)
      if (remaining <= 0) {
        lastRun = now
        if (timeoutId) {
          clearTimeout(timeoutId)
          timeoutId = null
        }
        measureAndUpdate()
      } else {
        if (timeoutId) clearTimeout(timeoutId)
        timeoutId = setTimeout(() => {
          lastRun = Date.now()
          measureAndUpdate()
          timeoutId = null
        }, remaining)
      }
    }

    // Initial measure
    measureAndUpdate()
    window.addEventListener("resize", handleResize)
    return () => {
      window.removeEventListener("resize", handleResize)
      if (timeoutId) clearTimeout(timeoutId)
    }
  })

  const actualIsDialog = isDialog === undefined ? !isBigEnough : isDialog

  return (
    <PopoverDialogContext.Provider value={actualIsDialog}>
      {actualIsDialog ? (
        <Dialog {...props} />
      ) : (
        <Popover {...props} modal={true} />
      )}
    </PopoverDialogContext.Provider>
  )
}
const PopoverDialogTrigger = ({
  ...props
}: React.ComponentProps<typeof PopoverTrigger>) => {
  const context = useContext(PopoverDialogContext)
  return context ? <DialogTrigger {...props} /> : <PopoverTrigger {...props} />
}

const PopoverDialogContent = ({
  ...props
}: React.ComponentProps<typeof PopoverContent>) => {
  const context = useContext(PopoverDialogContext)
  return context ? (
    <DialogContent showCloseButton={false} {...props} />
  ) : (
    <PopoverContent {...props} />
  )
}

// Conditional title component that uses DialogTitle when in dialog context
const PopoverDialogTitle = ({
  className,
  children,
  ...props
}: React.ComponentProps<"h4">) => {
  const context = useContext(PopoverDialogContext)

  if (context) {
    return (
      <DialogTitle className={className} {...props}>
        {children}
      </DialogTitle>
    )
  }

  return (
    <h4 className={className} {...props}>
      {children}
    </h4>
  )
}

const headerLabelClass =
  "flex min-w-0 flex-row items-center gap-2 overflow-hidden truncate text-xs leading-none"

const getIconFromEffectiveType = (
  type: string
): React.ComponentType<{ className?: string }> => {
  switch (type) {
    case "string":
      return Type
    case "boolean":
      return CheckSquare
    case "number":
    case "integer":
      return Hash
    case "object":
      return Box
    case "array":
      return Table
    case "date":
      return Calendar
    case "time":
      return Clock
    case "datetime":
      return CalendarClock
    case "enum":
      return List
    case "$ref":
      return Box
    default:
      return Type
  }
}

function renderIconFromEffectiveType(type: string) {
  const Icon = getIconFromEffectiveType(type)
  return <Icon className="size-3" />
}

interface JsonTableHeaderCellProps {
  node: JsonTableHeaderNode
  leafCount: number
  schema: JSONSchema7
  setSchema: (schema: JSONSchema7) => void
  stopAt: string[]
  setStopAt: (stopAt: string[]) => void
  columnWidth: ColumnWidth
  isPublished: boolean
  draggedItemKeyRef: React.RefObject<string | null>
  draggedItemParentPathRef: React.RefObject<string | null>
  editMode: "descriptionOnly" | "editable" | "readOnly"
  disableHeaderInteractions?: boolean
}

export function JsonTableHeaderCell({
  node,
  leafCount,
  schema,
  setSchema,
  stopAt,
  setStopAt,
  columnWidth,
  isPublished,
  draggedItemKeyRef,
  draggedItemParentPathRef,
  editMode,
  disableHeaderInteractions = false,
}: JsonTableHeaderCellProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const {
    isDraggable,
    clearDragClasses,
    handleDragStart,
    handleDragOver,
    handleDrop,
    handleDragEnd,
    toggleExpanded,
  } = useHeaderController({
    node,
    schema,
    setSchema,
    stopAt,
    setStopAt,
    draggedItemKeyRef,
    draggedItemParentPathRef,
    disableHeaderInteractions,
  })

  if (node.isArrayValuePlaceholder) {
    const headerWidth = getColumnWidthPx(columnWidth) - 20

    return (
      <Button
        variant="ghost"
        size="icon"
        className="grow justify-start rounded-none bg-transparent px-1 text-foreground hover:bg-muted/40"
      >
        <div
          className={headerLabelClass}
          style={{
            maxWidth: `${headerWidth}px`,
            minWidth: `${headerWidth}px`,
          }}
        >
          {renderIconFromEffectiveType(
            node.itemEffectiveType ?? node.effectiveType
          )}
          {node.label}
        </div>
      </Button>
    )
  }

  const headerWidth =
    getColumnWidthPx(columnWidth) * (node.isExpanded ? leafCount : 1) -
    (node.canFold ? 44 : 20)

  const headerLabel = (
    <div
      className={headerLabelClass}
      style={{
        maxWidth: `${headerWidth}px`,
        minWidth: `${headerWidth}px`,
      }}
    >
      {renderIconFromEffectiveType(node.effectiveType)}
      {node.label}
    </div>
  )

  return (
    <div
      className="group flex h-full w-full"
      draggable={isDraggable}
      onDragStart={handleDragStart}
      onDragOver={isDraggable ? handleDragOver : undefined}
      onDragLeave={(event) => clearDragClasses(event.currentTarget)}
      onDrop={isDraggable ? handleDrop : undefined}
      onDragEnd={handleDragEnd}
    >
      {disableHeaderInteractions ? (
        <div className="flex h-full grow items-center justify-start rounded-none bg-transparent px-1 text-foreground">
          {headerLabel}
        </div>
      ) : (
        <PopoverDialog open={dropdownOpen} onOpenChange={setDropdownOpen}>
          <PopoverDialogTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-full grow justify-start rounded-none bg-transparent px-1 text-foreground hover:bg-muted/40"
            >
              {headerLabel}
            </Button>
          </PopoverDialogTrigger>
          <PopoverDialogContent
            className="flex max-h-[80vh] w-[400px] flex-col gap-0 overflow-y-auto p-0"
            align="start"
          >
            <div className="flex items-center justify-between px-4 py-3">
              <PopoverDialogTitle className="leading-none font-medium">
                {node.label}
              </PopoverDialogTitle>
              {!isPublished && editMode !== "readOnly" && (
                <Button
                  tabIndex={-1}
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    if (
                      confirm(
                        `Are you sure you want to delete the property "${node.key}"? This action cannot be undone.`
                      )
                    ) {
                      setSchema(
                        deleteSchemaProperty({ schema, path: node.key })
                      )
                      setDropdownOpen(false)
                    }
                  }}
                >
                  <Trash2 className="size-4 text-destructive hover:text-destructive" />
                </Button>
              )}
            </div>

            <Separator />

            {node.isArray ? (
              <PropertyEditor
                property={node.rawSchema}
                propertyKey={node.key}
                setDropdownOpen={setDropdownOpen}
                jsonSchema={schema}
                setJsonSchema={setSchema}
                editMode={editMode}
              />
            ) : (
              <JsonSchemaEditorProvider
                jsonSchema={schema}
                setJsonSchema={(action) =>
                  setSchema(
                    typeof action === "function" ? action(schema) : action
                  )
                }
              >
                <PropertyEditor
                  property={node.rawSchema}
                  propertyKey={node.key}
                  setDropdownOpen={setDropdownOpen}
                  jsonSchema={schema}
                  setJsonSchema={setSchema}
                  editMode={editMode}
                />
              </JsonSchemaEditorProvider>
            )}
          </PopoverDialogContent>
        </PopoverDialog>
      )}
      {node.canFold && (
        <Button
          variant="ghost"
          size="icon"
          className={`h-full ${node.isArray ? "w-9" : "w-6"} rounded-none bg-transparent text-foreground hover:bg-muted/40`}
          onClick={toggleExpanded}
        >
          {stopAt.includes(node.key) ? (
            <ChevronDown className="size-3" />
          ) : (
            <ChevronUp className="size-3" />
          )}
        </Button>
      )}
    </div>
  )
}
