"use client"

import type * as React from "react"

import { Label } from "@/components/ui-retab/label"

export function ArrayItemsField({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-3 rounded-md border p-3">
      <Label className="text-xs text-muted-foreground">List item type</Label>
      {children}
    </div>
  )
}
