import * as React from "react"

import { cn } from "@/lib/utils"
import { Input, InputArea } from "@/components/ui-retab/input"

export function DoubleClickInput({
  className,
  disabled = false,
  ...props
}: React.ComponentProps<typeof Input>) {
  const inputRef = React.useRef<HTMLInputElement>(null)

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Enter" || event.key === "Escape") {
      inputRef.current?.blur()
      event.preventDefault()
    }
  }

  return (
    <Input
      {...props}
      className={cn(
        "cursor-default border-0 focus:cursor-text disabled:text-inherit disabled:opacity-100",
        className
      )}
      onKeyDown={handleKeyDown}
      onSubmit={() => inputRef.current?.blur()}
      ref={inputRef}
      onMouseDown={() => {}}
      onClick={(event) => {
        if (document.activeElement === inputRef.current) {
          event.stopPropagation()
        }
        props.onClick?.(event)
      }}
      onDoubleClick={() => {
        if (!disabled) inputRef.current?.focus()
      }}
      disabled={disabled}
    />
  )
}

export function DoubleClickTextarea({
  className,
  disabled = false,
  ...props
}: React.ComponentProps<typeof InputArea>) {
  const inputRef = React.useRef<HTMLTextAreaElement>(null)

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Enter" || event.key === "Escape") {
      inputRef.current?.blur()
      event.preventDefault()
    }
  }

  return (
    <InputArea
      {...props}
      className={cn("cursor-default focus:cursor-text", className)}
      onKeyDown={handleKeyDown}
      onSubmit={() => inputRef.current?.blur()}
      ref={inputRef}
      onMouseDown={() => {}}
      onClick={(event) => {
        if (document.activeElement === inputRef.current) {
          event.stopPropagation()
        }
        props.onClick?.(event)
      }}
      onDoubleClick={() => {
        if (!disabled) inputRef.current?.focus()
      }}
      readOnly={disabled}
    />
  )
}
