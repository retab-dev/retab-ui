"use client"

import * as React from "react"

import type { ViewerResource } from "@/lib/viewer-resource"
import { XlsxSheetTabs } from "@/components/ui/xlsx-sheet-tabs"
import { XlsxToolbar } from "@/components/ui/xlsx-toolbar"

import {
  XlsxGridColumn,
  XlsxSheetTabsSkeleton,
  XlsxViewerBody,
  XlsxViewerFrame,
} from "./xlsx-viewer-chrome"
import { useXlsxDownloadActions } from "./xlsx-viewer-download"
import { useXlsxScale } from "./xlsx-viewer-scale"
import { getXlsxSource } from "./xlsx-viewer-resource"
import { useXlsxScrollController } from "./xlsx-viewer-scroll"
import { XlsxViewerSheet, XlsxViewerSheetSkeleton } from "./xlsx-viewer-sheet"
import { useXlsxSheetState } from "./xlsx-viewer-sheet-state"
import type { XlsxViewerHandle, XlsxViewerProps } from "./xlsx-viewer-types"

export function XlsxViewerSession({
  resource,
  className,
  toolbar = true,
  defaultSheetIndex = 0,
  onSheetChange,
  fallbackSheetTabs = false,
  bare = false,
  slots,
  activeCell,
  isolateStyles = false,
  forwardedRef,
}: Omit<XlsxViewerProps, "source"> & {
  resource: ViewerResource
  forwardedRef?: React.ForwardedRef<XlsxViewerHandle>
}) {
  const viewportElementRef = React.useRef<HTMLDivElement | null>(null)
  const content = resource.content
  const sourcePromise = React.useMemo(() => getXlsxSource(content), [content])
  const {
    activeSheetIndex,
    activeSheet,
    sheets,
    isReady,
    reportSource,
    selectSheet,
    activateSheet,
  } = useXlsxSheetState({ defaultSheetIndex, onSheetChange })
  const { scale, zoomOut, zoomIn, resetZoom } = useXlsxScale()
  const { scrollRequest, scrollToCell } = useXlsxScrollController({
    activeSheetIndex,
    sheets,
    activateSheet,
  })

  React.useImperativeHandle(
    forwardedRef,
    () => ({
      scrollToCell,
      getViewportElement: () => viewportElementRef.current,
    }),
    [scrollToCell]
  )

  const isReservingFallbackSheetTabs = fallbackSheetTabs && !sheets
  const downloadActions = useXlsxDownloadActions({
    resource,
    activeSheet,
    activeSheetIndex,
    content,
    sheets,
  })

  return (
    <XlsxViewerFrame className={className} bare={bare}>
      {toolbar ? (
        <XlsxToolbar
          downloadActions={downloadActions}
          sheet={activeSheet ?? undefined}
          isReady={isReady}
          scale={scale}
          onZoomOut={zoomOut}
          onZoomIn={zoomIn}
          onResetZoom={resetZoom}
        />
      ) : null}

      <XlsxViewerBody
        toolbar={toolbar}
        fallbackSheetTabs={isReservingFallbackSheetTabs}
        slots={slots}
      >
        <XlsxGridColumn>
          <React.Suspense fallback={<XlsxViewerSheetSkeleton />}>
            <XlsxViewerSheet
              sourcePromise={sourcePromise}
              activeSheetIndex={activeSheetIndex}
              scale={scale}
              onReportSource={reportSource}
              activeCell={activeCell}
              scrollRequest={scrollRequest}
              isolateStyles={isolateStyles}
              viewportRef={viewportElementRef}
            />
          </React.Suspense>
        </XlsxGridColumn>
      </XlsxViewerBody>

      {sheets ? (
        <XlsxSheetTabs
          sheets={sheets}
          activeSheetIndex={activeSheetIndex}
          onSelectSheet={selectSheet}
        />
      ) : fallbackSheetTabs ? (
        <XlsxSheetTabsSkeleton />
      ) : null}
    </XlsxViewerFrame>
  )
}
