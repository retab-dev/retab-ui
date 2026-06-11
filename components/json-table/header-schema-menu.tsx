import React, { useContext, useState } from "react"
import type { JSONSchema7 } from "json-schema"
import { Trash2 } from "lucide-react"

import { useMountEffect } from "@/hooks/useMountEffect"
import type { JsonTableHeaderNode } from "@/components/json-table/lib/header-nodes"
import { deleteSchemaProperty } from "@/components/json-table/lib/schema-mutations"
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

function schemaObject(schema: JsonTableHeaderNode["rawSchema"]): JSONSchema7 {
  return typeof schema === "object" && schema !== null ? schema : {}
}

function PopoverDialog({
  isDialog,
  ...props
}: {
  isDialog?: boolean
} & React.ComponentProps<typeof Popover>) {
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

function PopoverDialogTrigger({
  ...props
}: React.ComponentProps<typeof PopoverTrigger>) {
  const context = useContext(PopoverDialogContext)
  return context ? <DialogTrigger {...props} /> : <PopoverTrigger {...props} />
}

function PopoverDialogContent({
  ...props
}: React.ComponentProps<typeof PopoverContent>) {
  const context = useContext(PopoverDialogContext)
  return context ? (
    <DialogContent showCloseButton={false} {...props} />
  ) : (
    <PopoverContent {...props} />
  )
}

function PopoverDialogTitle({
  className,
  children,
  ...props
}: React.ComponentProps<"h4">) {
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

export function HeaderSchemaMenu({
  node,
  schema,
  setSchema,
  isPublished,
  editMode,
  open,
  onOpenChange,
  children,
}: {
  node: JsonTableHeaderNode
  schema: JSONSchema7
  setSchema: (schema: JSONSchema7) => void
  isPublished: boolean
  editMode: "descriptionOnly" | "editable" | "readOnly"
  open: boolean
  onOpenChange: (open: boolean) => void
  children: React.ReactNode
}) {
  return (
    <PopoverDialog open={open} onOpenChange={onOpenChange}>
      <PopoverDialogTrigger asChild>{children}</PopoverDialogTrigger>
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
                    deleteSchemaProperty({
                      schema,
                      schemaPropertyPath: node.key,
                    })
                  )
                  onOpenChange(false)
                }
              }}
            >
              <Trash2 className="size-4 text-destructive hover:text-destructive" />
            </Button>
          )}
        </div>

        <Separator />

        <PropertyEditor
          property={schemaObject(node.rawSchema)}
          propertyKey={node.key}
          setDropdownOpen={onOpenChange}
          schema={schema}
          replaceSchema={setSchema}
          editMode={editMode}
        />
      </PopoverDialogContent>
    </PopoverDialog>
  )
}
