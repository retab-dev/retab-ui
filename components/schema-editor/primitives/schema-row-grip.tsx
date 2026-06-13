"use client"

import { GripVertical } from "lucide-react"

import { cn } from "@/lib/utils"

export type SchemaRowGripMode = "drag" | "static" | "empty"

interface SchemaRowGripProps {
  mode: SchemaRowGripMode
  className?: string
}

export function SchemaRowGrip({ mode, className }: SchemaRowGripProps) {
  if (mode === "empty") {
    return <div className={cn("h-12 w-6 px-1 py-4", className)} />
  }

  return (
    <GripVertical
      aria-hidden="true"
      className={cn(
        "h-12 w-6 px-1 py-4",
        mode === "drag"
          ? "cursor-pointer text-transparent group-hover:text-muted-foreground"
          : "text-muted-foreground",
        className
      )}
    />
  )
}
