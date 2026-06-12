"use client"

import * as React from "react"

import { DocxViewer } from "@/components/ui/docx-viewer"
import { ImageViewer } from "@/components/ui/image-viewer"
import { PdfViewer } from "@/components/ui/pdf-viewer"
import { PptxViewer } from "@/components/ui/pptx-viewer"
import { TextViewer } from "@/components/ui/text-viewer"
import { XlsxViewer } from "@/components/ui/xlsx-viewer"

type VerifierFixture = {
  id: string
  label: string
  source: {
    fileName: string
    mimeType?: string
    url: string
  }
  fallbackFrameSize?: { width: number; height: number }
  fallbackSheetTabs?: boolean
  fallbackSlideSize?: { width: number; height: number }
}

type VerifierRect = {
  bottom: number
  height: number
  left: number
  right: number
  top: number
  width: number
}

type VerifierSnapshot = {
  loadedRect: VerifierRect | null
  skeletonRect: VerifierRect | null
  viewerRect: VerifierRect | null
}

declare global {
  interface Window {
    __viewerSkeletonVerifier?: {
      snapshot: (selectors: {
        loadedSelector: string
        readySelector?: string
        skeletonSelector: string
      }) => VerifierSnapshot
    }
  }
}

export function ViewerSkeletonVerifierClient({
  fixture,
  runId,
}: {
  fixture: VerifierFixture
  runId?: string
}) {
  React.useEffect(() => {
    const verifier = { snapshot: readSnapshot }
    window.__viewerSkeletonVerifier = verifier
    return () => {
      if (window.__viewerSkeletonVerifier === verifier) {
        window.__viewerSkeletonVerifier = undefined
      }
    }
  }, [])

  return (
    <main
      className="flex h-svh min-h-0 items-start justify-center overflow-auto bg-background px-4 py-6"
      data-testid="viewer-skeleton-verifier"
      data-viewer={fixture.id}
    >
      <div className="h-[600px] w-full max-w-[40rem]">
        {renderViewer(fixture, runId)}
      </div>
    </main>
  )
}

function renderViewer(fixture: VerifierFixture, runId: string | undefined) {
  const searchParams = new URLSearchParams({
    "viewer-skeleton": fixture.id,
  })
  if (runId) searchParams.set("run", runId)
  const source = {
    kind: "url" as const,
    url: `${fixture.source.url}?${searchParams.toString()}`,
    fileName: fixture.source.fileName,
    mimeType: fixture.source.mimeType,
  }

  if (fixture.id === "image") {
    return (
      <ImageViewer
        source={source}
        fallbackFrameSize={fixture.fallbackFrameSize}
        className="h-full"
      />
    )
  }
  if (fixture.id === "pdf") {
    return <PdfViewer source={source} className="h-full" />
  }
  if (fixture.id === "docx") {
    return <DocxViewer source={source} className="h-full" />
  }
  if (fixture.id === "pptx") {
    return (
      <PptxViewer
        source={source}
        className="h-full"
        fallbackSlideSize={fixture.fallbackSlideSize}
      />
    )
  }
  if (fixture.id === "xlsx") {
    return (
      <XlsxViewer
        source={source}
        className="h-full"
        fallbackSheetTabs={fixture.fallbackSheetTabs}
        isolateStyles
      />
    )
  }
  if (fixture.id === "text") {
    return <TextViewer source={source} className="h-full" />
  }
  return null
}

function readSnapshot(selectors: {
  loadedSelector: string
  readySelector?: string
  skeletonSelector: string
}): VerifierSnapshot & { readyRect: VerifierRect | null } {
  return {
    loadedRect: getRect(deepQuerySelector(selectors.loadedSelector)),
    readyRect: getRect(
      selectors.readySelector
        ? deepQuerySelector(selectors.readySelector)
        : null
    ),
    skeletonRect: getRect(deepQuerySelector(selectors.skeletonSelector)),
    viewerRect: getRect(
      document.querySelector("[data-testid='viewer-skeleton-verifier']")
    ),
  }
}

function deepQuerySelector(selector: string): Element | null {
  const direct = document.querySelector(selector)
  if (direct) return direct

  const roots = Array.from(document.querySelectorAll("*"))
    .map((element) => element.shadowRoot)
    .filter((root): root is ShadowRoot => Boolean(root))

  for (const root of roots) {
    const match = root.querySelector(selector)
    if (match) return match
  }
  return null
}

function getRect(element: Element | null): VerifierRect | null {
  if (!element) return null
  const rect = element.getBoundingClientRect()
  return {
    bottom: roundRectValue(rect.bottom),
    height: roundRectValue(rect.height),
    left: roundRectValue(rect.left),
    right: roundRectValue(rect.right),
    top: roundRectValue(rect.top),
    width: roundRectValue(rect.width),
  }
}

function roundRectValue(value: number) {
  return Math.round(value * 100) / 100
}
