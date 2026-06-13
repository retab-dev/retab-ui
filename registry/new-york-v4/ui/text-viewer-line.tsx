"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

export function TextLine({
  gutterWidth,
  isHighlighted,
  lineNumber,
  style,
  text,
}: {
  gutterWidth: string
  isHighlighted: boolean
  lineNumber: number
  style: React.CSSProperties
  text: string
}) {
  return (
    <div
      data-line-number={lineNumber}
      className={cn(
        "absolute top-0 left-0 flex min-w-full px-2",
        isHighlighted && "bg-primary/12 ring-1 ring-primary/30 ring-inset"
      )}
      style={style}
    >
      <span
        className="flex-shrink-0 pr-3 text-right text-muted-foreground/60 select-none"
        style={{ width: gutterWidth }}
      >
        {lineNumber}
      </span>
      <span className="whitespace-pre">{text || " "}</span>
    </div>
  )
}
