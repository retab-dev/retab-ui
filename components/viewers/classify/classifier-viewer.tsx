"use client"

import { useCallback, useMemo, useRef, type ReactNode } from "react"
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

export interface ClassifierViewerProps {
  result: ClassifyResult | null
  isProcessing?: boolean
  emptyTitle?: string
  emptyDescription?: string
  renderDocument?: () => ReactNode
}

/**
 * A classification is a single category over the whole document, so it reduces
 * to one `Segment` — shown as a swatch + label in the legend. No bespoke chrome:
 * the same file + legend system the split and partition viewers use.
 */
export function ClassifierViewer({
  result,
  isProcessing = false,
  emptyTitle = "Run classify to see output",
  emptyDescription = "Provide input, define categories, and click Run Classify",
  renderDocument,
}: ClassifierViewerProps) {
  const interaction = useSegmentInteraction()
  const previewRef = useRef<HTMLDivElement | null>(null)

  const category = result?.category ?? null
  const reasoning = result?.reasoning?.trim() || null

  const segments = useMemo<Segment[]>(() => {
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

  const handleJumpToTop = useCallback(() => {
    previewRef.current
      ?.querySelector<HTMLElement>(`[data-page-number="1"]`)
      ?.scrollIntoView({ behavior: "smooth", block: "start" })
  }, [])

  return (
    <ViewerRoot ref={previewRef} bare className="h-full flex-1 bg-background">
      {category ? (
        <ViewerHeader className="bg-background">
          <SegmentLegend
            variant="plain"
            segments={segments}
            interaction={interaction}
            onSelect={handleJumpToTop}
            className="px-3 py-2"
            caption={
              reasoning ? <span title={reasoning}>{reasoning}</span> : undefined
            }
          />
        </ViewerHeader>
      ) : null}
      <ViewerBody>
        <ViewerSurface>
          {category ? (
            renderDocument ? (
              renderDocument()
            ) : (
              <div className="flex h-full flex-1 items-center justify-center">
                <span className="text-sm text-muted-foreground">
                  No document available
                </span>
              </div>
            )
          ) : (
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
          )}
        </ViewerSurface>
      </ViewerBody>
    </ViewerRoot>
  )
}
