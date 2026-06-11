"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import type { UseSourceLinkResult } from "@/hooks/use-source-link"
import { ScrollArea } from "@/components/ui/scroll-area"

export interface SourceField {
  /** Join key — must match the `SourceMap` key for this field. */
  key: string
  label: string
  value: React.ReactNode
  /** Optional small hint under the value (e.g. "Page 2", "Line 14", "Sheet 1 · B7"). */
  hint?: string
}

/**
 * A simple field list that drives a `useSourceLink`: hovering a field previews
 * its source in the viewer, clicking pins it. The emitter side of a source
 * block — pair it with any source-capable viewer.
 */
export function SourceFieldList({
  fields,
  link,
  title = "Extracted fields",
  className,
}: {
  fields: SourceField[]
  link: Pick<
    UseSourceLinkResult,
    "activePath" | "onFieldHover" | "selectField"
  >
  title?: string
  className?: string
}) {
  return (
    <aside
      className={cn(
        "flex w-[360px] flex-shrink-0 flex-col border-l",
        className
      )}
    >
      <div className="flex h-10 flex-shrink-0 items-center border-b px-4">
        <h2 className="text-sm font-medium">{title}</h2>
        <span className="ml-auto text-xs text-muted-foreground tabular-nums">
          {fields.length} fields
        </span>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-1 p-3">
          {fields.map((field) => {
            const active = field.key === link.activePath
            return (
              <button
                key={field.key}
                type="button"
                onMouseEnter={() => link.onFieldHover(field.key)}
                onMouseLeave={() => link.onFieldHover(null)}
                onFocus={() => link.onFieldHover(field.key)}
                onBlur={() => link.onFieldHover(null)}
                onClick={() => link.selectField(field.key)}
                className={cn(
                  "flex flex-col gap-0.5 rounded-md border px-3 py-2 text-left transition-colors",
                  active
                    ? "border-primary/40 bg-primary/5"
                    : "border-transparent hover:bg-muted/60"
                )}
              >
                <span className="text-xs text-muted-foreground">
                  {field.label}
                </span>
                <span className="text-sm tabular-nums">{field.value}</span>
                {field.hint ? (
                  <span className="text-[11px] text-muted-foreground/70">
                    {field.hint}
                  </span>
                ) : null}
              </button>
            )
          })}
        </div>
      </ScrollArea>
    </aside>
  )
}
