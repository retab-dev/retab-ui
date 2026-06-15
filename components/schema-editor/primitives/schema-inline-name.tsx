"use client"

import { EyeIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { SchemaInlineText } from "@/components/schema-editor/primitives/schema-inline-text"

interface SchemaInlineNameProps {
  ariaLabel: string
  editable: boolean
  value: string
  canRename?: boolean
  reference?: {
    label: string
    onReveal: () => void
  }
  validate?: (value: string) => string | null
  onCommit?: (value: string) => void
}

export function SchemaInlineName({
  ariaLabel,
  editable,
  value,
  canRename = true,
  reference,
  validate = () => null,
  onCommit,
}: SchemaInlineNameProps) {
  const canEditName = editable && canRename

  return (
    <span className="flex min-w-0 items-center">
      <SchemaInlineText
        ariaLabel={ariaLabel}
        editable={canEditName}
        value={value}
        className="m-0 h-6 w-36 rounded-sm border-none bg-transparent px-1 text-sm font-medium text-foreground shadow-none outline-none focus-visible:ring-0"
        readOnlyClassName="mr-1 truncate text-sm font-medium whitespace-nowrap text-foreground"
        validate={validate}
        onCommit={(nextValue) => {
          if (nextValue) onCommit?.(nextValue)
        }}
      />
      {reference && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-4 w-4 p-0"
          aria-label={`Show ${reference.label} definition`}
          onClick={reference.onReveal}
        >
          <EyeIcon className="h-4 w-4 text-muted-foreground" />
        </Button>
      )}
    </span>
  )
}
