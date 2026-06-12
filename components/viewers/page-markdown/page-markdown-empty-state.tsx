"use client"

import { ScanText } from "lucide-react"

import { Spinner } from "@/components/ui/spinner"

export function PageMarkdownEmptyState({
  isProcessing,
  processingLabel,
}: {
  isProcessing: boolean
  processingLabel: string
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 bg-muted/30 px-8 text-muted-foreground">
      {isProcessing ? (
        <>
          <Spinner className="size-8 text-primary" />
          <p className="text-sm">{processingLabel}</p>
        </>
      ) : (
        <>
          <ScanText className="size-12 opacity-60" />
          <div className="space-y-1 text-center">
            <p className="text-sm font-medium text-foreground">
              No markdown pages yet
            </p>
            <p className="max-w-xs text-xs">
              Provide page-by-page markdown to see the rendered document here.
            </p>
          </div>
        </>
      )}
    </div>
  )
}
