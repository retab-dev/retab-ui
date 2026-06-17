"use client"

import * as React from "react"

export const JsonFormOpenPathsContext =
  React.createContext<ReadonlySet<string> | null>(null)

export function useJsonFormStartsOpen(sourcePath: string, fallback: boolean) {
  return React.useContext(JsonFormOpenPathsContext)?.has(sourcePath) ?? fallback
}
