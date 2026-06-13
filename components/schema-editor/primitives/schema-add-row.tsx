"use client"

import { AlertCircle, PlusIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

interface SchemaAddRowProps {
  ariaLabel: string
  buttonLabel?: string
  className?: string
  disabled: boolean
  error: string | null
  placeholder: string
  value: string
  onAdd: () => void
  onChange: (value: string) => void
}

export function SchemaAddRow({
  ariaLabel,
  buttonLabel = "Add",
  className,
  disabled,
  error,
  placeholder,
  value,
  onAdd,
  onChange,
}: SchemaAddRowProps) {
  const isAddDisabled = disabled || !value.trim() || Boolean(error)

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <div className="flex items-center gap-3">
        <Input
          aria-label={ariaLabel}
          placeholder={placeholder}
          disabled={disabled}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault()
              event.stopPropagation()
              if (!isAddDisabled) onAdd()
            }
          }}
          className={`h-8 w-40 ${error ? "border-destructive" : ""}`}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isAddDisabled}
          className={isAddDisabled ? "cursor-not-allowed" : ""}
          onClick={onAdd}
        >
          <PlusIcon className="h-4 w-4" />
          <span>{buttonLabel}</span>
        </Button>
      </div>

      {error && (
        <p className="flex items-center gap-1 text-xs text-destructive">
          <AlertCircle className="h-3 w-3" /> {error}
        </p>
      )}
    </div>
  )
}
