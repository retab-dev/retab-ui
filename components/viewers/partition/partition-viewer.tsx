"use client"

import * as React from "react"
import { Key, Loader2 } from "lucide-react"

import { PageRibbon } from "@/components/ui/page-ribbon"
import { SegmentLegend } from "@/components/ui/segment-legend"
import {
  SegmentedDocumentProvider,
  useSegmentedDocumentViewport,
} from "@/components/ui/segmented-document-provider"
import { type SegmentViewportController } from "@/components/ui/use-segment-viewport-controller"
import {
  ViewerBody,
  ViewerHeader,
  ViewerRoot,
  ViewerSurface,
} from "@/components/ui/viewer"
import type { PartitionResult } from "@/components/viewers/lib/partition-types"

import {
  createPartitionSegmentedDocumentModel,
  createPartitionViewerModel,
  type PartitionViewerModel,
} from "./partition-viewer-model"

export type PartitionDocumentControls =
  SegmentViewportController["documentHandlers"]

type PartitionViewerContextValue = {
  isProcessing: boolean
  model: PartitionViewerModel
  viewport: SegmentViewportController
}

const PartitionViewerContext =
  React.createContext<PartitionViewerContextValue | null>(null)

export interface PartitionViewerProviderProps {
  result: PartitionResult | null
  isProcessing?: boolean
  children: React.ReactNode
}

export interface PartitionViewerProps {
  result: PartitionResult | null
  isProcessing?: boolean
}

export function usePartitionViewer() {
  const context = React.useContext(PartitionViewerContext)
  if (!context) {
    throw new Error(
      "usePartitionViewer must be used within PartitionViewerProvider."
    )
  }
  return context
}

export function usePartitionViewerHeader() {
  const { model, viewport } = usePartitionViewer()

  return {
    currentPage: viewport.model.currentPage,
    interaction: viewport.interaction,
    legendSegments: model.legendSegments,
    navigation: viewport.navigation,
    pageCount: model.pageCount,
    rows: model.ribbonRows,
    scrollProgress: viewport.model.scrollProgress,
  }
}

export function usePartitionViewerDocumentControls(): PartitionDocumentControls {
  return usePartitionViewer().viewport.documentHandlers
}

export function usePartitionViewerModel(): PartitionViewerModel {
  return usePartitionViewer().model
}

export function PartitionViewerProvider({
  result,
  isProcessing = false,
  children,
}: PartitionViewerProviderProps) {
  const model = React.useMemo(
    () => createPartitionViewerModel(result),
    [result]
  )
  const segmentedDocumentModel = React.useMemo(
    () => createPartitionSegmentedDocumentModel(model),
    [model]
  )

  return (
    <SegmentedDocumentProvider model={segmentedDocumentModel}>
      <PartitionViewerContextProvider isProcessing={isProcessing} model={model}>
        {children}
      </PartitionViewerContextProvider>
    </SegmentedDocumentProvider>
  )
}

function PartitionViewerContextProvider({
  children,
  isProcessing,
  model,
}: {
  children: React.ReactNode
  isProcessing: boolean
  model: PartitionViewerModel
}) {
  const viewport = useSegmentedDocumentViewport()

  const value = React.useMemo<PartitionViewerContextValue>(
    () => ({
      isProcessing,
      model,
      viewport,
    }),
    [isProcessing, model, viewport]
  )

  return (
    <PartitionViewerContext.Provider value={value}>
      {children}
    </PartitionViewerContext.Provider>
  )
}

export function PartitionViewerHeader({ className }: { className?: string }) {
  const {
    currentPage,
    interaction,
    legendSegments,
    navigation,
    pageCount,
    rows,
    scrollProgress,
  } = usePartitionViewerHeader()

  if (legendSegments.length === 0) return null

  return (
    <ViewerHeader className={className ?? "space-y-2 bg-background px-3 py-2"}>
      <SegmentLegend
        variant="plain"
        segments={legendSegments}
        currentPage={currentPage}
        interaction={interaction}
        onSelect={navigation.scrollToSegmentStart}
        columns={4}
      />
      <PageRibbon
        orientation="horizontal"
        rows={rows}
        pageCount={pageCount}
        currentPage={currentPage}
        scrollProgress={scrollProgress}
        interaction={interaction}
        onSelectPage={navigation.scrollToPage}
      />
    </ViewerHeader>
  )
}

export function PartitionViewerDocument() {
  const { model } = usePartitionViewer()

  if (!model.hasOutput) return <PartitionViewerEmptyState />

  return (
    <div className="flex h-full flex-1 items-center justify-center">
      <span className="text-sm text-muted-foreground">
        No document available
      </span>
    </div>
  )
}

export function PartitionViewerEmptyState() {
  const { isProcessing } = usePartitionViewer()

  return (
    <div className="flex h-full flex-1 flex-col items-center justify-center gap-4 bg-muted px-8 text-muted-foreground">
      {isProcessing ? (
        <>
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="text-center text-base text-muted-foreground">
            Partitioning...
          </p>
        </>
      ) : (
        <>
          <Key className="h-16 w-16 text-muted-foreground" />
          <p className="text-center text-base text-muted-foreground">
            Run partition to see output
          </p>
          <p className="max-w-sm text-center text-sm text-muted-foreground">
            Upload a document, set a key and instructions, then click Run
            Partition
          </p>
        </>
      )}
    </div>
  )
}

export function PartitionViewer({
  result,
  isProcessing = false,
}: PartitionViewerProps) {
  return (
    <PartitionViewerProvider result={result} isProcessing={isProcessing}>
      <ViewerRoot bare className="h-full flex-1 bg-background">
        <PartitionViewerHeader />
        <ViewerBody>
          <ViewerSurface>
            <PartitionViewerDocument />
          </ViewerSurface>
        </ViewerBody>
      </ViewerRoot>
    </PartitionViewerProvider>
  )
}
