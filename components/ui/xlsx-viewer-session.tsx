"use client"

import * as React from "react"

import type { ViewerResource } from "@/lib/viewer-resource"
import { ViewerControls } from "@/components/ui/viewer-controls"
import { XlsxSheetTabs } from "@/components/ui/xlsx-sheet-tabs"

import {
  XlsxGridColumn,
  XlsxSheetTabsSkeleton,
  XlsxViewerBody,
  XlsxViewerFrame,
} from "./xlsx-viewer-chrome"
import { useXlsxDownloadActions } from "./xlsx-viewer-download"
import { getXlsxSource } from "./xlsx-viewer-resource"
import { useXlsxScale } from "./xlsx-viewer-scale"
import { useXlsxScrollController } from "./xlsx-viewer-scroll"
import { XlsxViewerSheet, XlsxViewerSheetSkeleton } from "./xlsx-viewer-sheet"
import { useXlsxSheetState } from "./xlsx-viewer-sheet-state"
import type { XlsxViewerHandle, XlsxViewerProps } from "./xlsx-viewer-types"

export function XlsxViewerSession({
  resource,
  className,
  controls = true,
  download = true,
  defaultSheetIndex = 0,
  onSheetChange,
  fallbackSheetTabs = false,
  bare = false,
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
    forwardedRef ?? null,
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
  const controlsDownloadActions = download ? downloadActions : []

  return (
    <XlsxViewerFrame className={className} bare={bare}>
      {controls ? (
        <ViewerControls
          title={isReady ? (activeSheet?.name ?? "-") : null}
          subtitle={
            isReady && activeSheet
              ? `${activeSheet.rowCount.toLocaleString()} x ${
                  activeSheet.columnCount
                }`
              : null
          }
          loading={!isReady}
          zoom={{
            scale,
            onZoomOut: zoomOut,
            onZoomIn: zoomIn,
            onFit: resetZoom,
            fitLabel: "Actual size",
          }}
          downloads={controlsDownloadActions}
        />
      ) : null}

      <XlsxViewerBody
        controls={controls}
        fallbackSheetTabs={isReservingFallbackSheetTabs}
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
