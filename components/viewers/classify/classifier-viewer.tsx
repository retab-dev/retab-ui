"use client"

import * as React from "react"
import { Loader2, Tags } from "lucide-react"

import { buildColorMap, type Segment } from "@/lib/segments"
import { SegmentLegend } from "@/components/ui/segment-legend"
import { useSegmentInteraction } from "@/components/ui/use-segment-interaction"
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
  segments: Segment[]
  requestDocumentStart: () => void
}

const ClassifierViewerContext =
  React.createContext<ClassifierViewerContextValue | null>(null)

export interface ClassifierViewerProviderProps {
  result: ClassifyResult | null
  isProcessing?: boolean
  emptyTitle?: string
  emptyDescription?: string
  onSelectDocumentStart?: () => void
  children: React.ReactNode
}

export interface ClassifierViewerProps {
  result: ClassifyResult | null
  isProcessing?: boolean
  emptyTitle?: string
  emptyDescription?: string
}

export function useClassifierViewer() {
  const context = React.useContext(ClassifierViewerContext)
  if (!context) {
    throw new Error(
      "useClassifierViewer must be used within ClassifierViewerProvider."
    )
  }
  return context
}

export function useClassifierViewerHeader() {
  const { category, reasoning, requestDocumentStart, segments } =
    useClassifierViewer()

  return {
    category,
    reasoning,
    requestDocumentStart,
    segments,
  }
}

export function ClassifierViewerProvider({
  result,
  isProcessing = false,
  emptyTitle = "Run classify to see output",
  emptyDescription = "Provide input, define categories, and click Run Classify",
  onSelectDocumentStart,
  children,
}: ClassifierViewerProviderProps) {
  const category = result?.category ?? null
  const reasoning = result?.reasoning?.trim() || null
  const segments = React.useMemo<Segment[]>(() => {
    if (!category) return []
    const colors = buildColorMap([category])
    return [
      {
        id: "classification",
        label: category,
        pages: [1],
        color: colors.get(category) ?? "#4E79A7",
        index: 0,
      },
    ]
  }, [category])
  const requestDocumentStart = React.useCallback(() => {
    onSelectDocumentStart?.()
  }, [onSelectDocumentStart])
  const value = React.useMemo<ClassifierViewerContextValue>(
    () => ({
      category,
      emptyDescription,
      emptyTitle,
      isProcessing,
      reasoning,
      requestDocumentStart,
      result,
      segments,
    }),
    [
      category,
      emptyDescription,
      emptyTitle,
      isProcessing,
      reasoning,
      requestDocumentStart,
      result,
      segments,
    ]
  )

  return (
    <ClassifierViewerContext.Provider value={value}>
      {children}
    </ClassifierViewerContext.Provider>
  )
}

export function ClassifierViewerHeader({ className }: { className?: string }) {
  const interaction = useSegmentInteraction()
  const { category, reasoning, requestDocumentStart, segments } =
    useClassifierViewerHeader()

  if (!category) return null

  return (
    <ViewerHeader className={className ?? "bg-background"}>
      <SegmentLegend
        variant="plain"
        segments={segments}
        interaction={interaction}
        onSelect={requestDocumentStart}
        className="px-3 py-2"
        caption={
          reasoning ? <span title={reasoning}>{reasoning}</span> : undefined
        }
      />
    </ViewerHeader>
  )
}

export function ClassifierViewerEmptyState() {
  const { emptyDescription, emptyTitle, isProcessing } = useClassifierViewer()

  return (
    <div className="flex h-full flex-1 flex-col items-center justify-center gap-4 bg-muted px-8 text-muted-foreground">
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

export function ClassifierViewerDocumentState() {
  const { category } = useClassifierViewer()

  if (!category) return <ClassifierViewerEmptyState />

  return (
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
            <ClassifierViewerDocumentState />
          </ViewerSurface>
        </ViewerBody>
      </ViewerRoot>
    </ClassifierViewerProvider>
  )
}
