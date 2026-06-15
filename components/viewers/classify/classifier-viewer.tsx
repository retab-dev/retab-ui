"use client"

import * as React from "react"
import { Loader2, Tags } from "lucide-react"

import { cn } from "@/lib/utils"
import {
  ViewerBody,
  ViewerHeader,
  ViewerRoot,
  ViewerSurface,
} from "@/components/ui/viewer"
import type { ClassifyResult } from "@/components/viewers/lib/classify-types"

type ClassifierViewerContextValue = {
  category: string | null
  emptyDescription: string
  emptyTitle: string
  isProcessing: boolean
  reasoning: string | null
  result: ClassifyResult | null
}

export type ClassifierViewerState = {
  category: string | null
  hasOutput: boolean
  isProcessing: boolean
}

export type ClassifierViewerHeaderState = {
  category: string | null
  reasoning: string | null
}

export type ClassifierViewerEmptyStatusState = {
  emptyDescription: string
  emptyTitle: string
  isProcessing: boolean
}

export type ClassifierViewerDocumentState = {
  hasOutput: boolean
}

const ClassifierViewerContext =
  React.createContext<ClassifierViewerContextValue | null>(null)

export interface ClassifierViewerProviderProps {
  result: ClassifyResult | null
  isProcessing?: boolean
  emptyTitle?: string
  emptyDescription?: string
  children: React.ReactNode
}

export interface ClassifierViewerProps {
  result: ClassifyResult | null
  isProcessing?: boolean
  emptyTitle?: string
  emptyDescription?: string
  document?: React.ReactNode
}

function useClassifierViewerContext(): ClassifierViewerContextValue {
  const context = React.useContext(ClassifierViewerContext)
  if (!context) {
    throw new Error(
      "useClassifierViewer must be used within ClassifierViewerProvider."
    )
  }
  return context
}

export function useClassifierViewer(): ClassifierViewerState {
  const { category, isProcessing } = useClassifierViewerContext()
  return {
    category,
    hasOutput: category !== null,
    isProcessing,
  }
}

export function useClassifierViewerHeader(): ClassifierViewerHeaderState {
  const { category, reasoning } = useClassifierViewerContext()

  return {
    category,
    reasoning,
  }
}

export function useClassifierViewerEmpty(): ClassifierViewerEmptyStatusState {
  const { emptyDescription, emptyTitle, isProcessing } =
    useClassifierViewerContext()
  return {
    emptyDescription,
    emptyTitle,
    isProcessing,
  }
}

export function useClassifierViewerDocument(): ClassifierViewerDocumentState {
  return {
    hasOutput: useClassifierViewerContext().category !== null,
  }
}

export function ClassifierViewerProvider({
  result,
  isProcessing = false,
  emptyTitle = "Run classify to see output",
  emptyDescription = "Provide input, define categories, and click Run Classify",
  children,
}: ClassifierViewerProviderProps) {
  const category = result?.category ?? null
  const reasoning = result?.reasoning?.trim() || null
  const value = React.useMemo<ClassifierViewerContextValue>(
    () => ({
      category,
      emptyDescription,
      emptyTitle,
      isProcessing,
      reasoning,
      result,
    }),
    [category, emptyDescription, emptyTitle, isProcessing, reasoning, result]
  )

  return (
    <ClassifierViewerContext.Provider value={value}>
      {children}
    </ClassifierViewerContext.Provider>
  )
}

export function ClassifierViewerHeader({ className }: { className?: string }) {
  const { category, reasoning } = useClassifierViewerHeader()

  if (!category) return null

  const categoryNode = (
    <span className="inline-flex min-h-7 min-w-0 items-center rounded-md border bg-background px-2.5 text-sm font-medium text-foreground">
      <span className="truncate">{category}</span>
    </span>
  )

  return (
    <ViewerHeader
      className={cn(
        "flex min-h-10 items-center gap-3 bg-background px-3 py-2",
        className
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <Tags className="size-4 shrink-0 text-muted-foreground" />
        <span className="shrink-0 text-sm font-medium">Classification</span>
        <span className="min-w-0">{categoryNode}</span>
      </div>
      {reasoning ? (
        <span
          className="max-w-[50%] min-w-0 truncate text-xs text-muted-foreground"
          title={reasoning}
        >
          {reasoning}
        </span>
      ) : null}
    </ViewerHeader>
  )
}

export function ClassifierViewerEmptyState() {
  const { emptyDescription, emptyTitle, isProcessing } =
    useClassifierViewerEmpty()

  return (
    <div className="flex h-full flex-1 flex-col items-center justify-center gap-4 bg-background px-8 text-muted-foreground">
      {isProcessing ? (
        <>
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="text-center text-base text-muted-foreground">
            Classifying...
          </p>
        </>
      ) : (
        <>
          <Tags className="h-16 w-16 text-muted-foreground" />
          <p className="text-center text-base text-muted-foreground">
            {emptyTitle}
          </p>
          <p className="max-w-sm text-center text-sm text-muted-foreground">
            {emptyDescription}
          </p>
        </>
      )}
    </div>
  )
}

export function ClassifierViewerDocument({
  document,
}: {
  document?: React.ReactNode
}) {
  const { hasOutput } = useClassifierViewerDocument()

  if (!hasOutput) return <ClassifierViewerEmptyState />

  return document ? (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">{document}</div>
  ) : (
    <div className="flex h-full flex-1 items-center justify-center">
      <span className="text-sm text-muted-foreground">
        No document available
      </span>
    </div>
  )
}

export function ClassifierViewer({
  result,
  isProcessing = false,
  emptyTitle,
  emptyDescription,
  document,
}: ClassifierViewerProps) {
  return (
    <ClassifierViewerProvider
      result={result}
      isProcessing={isProcessing}
      emptyTitle={emptyTitle}
      emptyDescription={emptyDescription}
    >
      <ViewerRoot bare className="h-full flex-1 bg-background">
        <ClassifierViewerHeader />
        <ViewerBody>
          <ViewerSurface>
            <ClassifierViewerDocument document={document} />
          </ViewerSurface>
        </ViewerBody>
      </ViewerRoot>
    </ClassifierViewerProvider>
  )
}
