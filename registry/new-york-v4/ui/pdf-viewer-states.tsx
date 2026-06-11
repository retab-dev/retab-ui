import * as React from "react"
import {
  Download,
  Maximize,
  Minus,
  PanelLeftClose,
  Plus,
  RotateCw,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"

export function PdfViewerFallback({
  className,
  bare = false,
  toolbar = true,
  showRailToggle = false,
}: {
  className?: string
  bare?: boolean
  toolbar?: boolean
  showRailToggle?: boolean
}) {
  return (
    <div
      className={cn(
        "flex min-h-0 flex-col overflow-hidden",
        bare ? "h-full bg-muted/20" : "rounded-xl border bg-muted/30",
        className
      )}
      data-slot="pdf-viewer"
    >
      {toolbar ? <PdfToolbarSkeleton showRailToggle={showRailToggle} /> : null}
      <div className="min-h-0 flex-1 overflow-auto">
        <div className="flex flex-col items-center p-4">
          <PageAspectSkeleton />
        </div>
      </div>
    </div>
  )
}

export function PageSkeleton() {
  return <Skeleton className="size-full rounded-md" />
}

export class PdfErrorBoundary extends React.Component<
  { children: React.ReactNode; className?: string; resetKey?: unknown },
  { error: boolean; retryKey: number }
> {
  state = { error: false, retryKey: 0 }

  componentDidUpdate(previousProps: { resetKey?: unknown }) {
    if (previousProps.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: false })
    }
  }

  static getDerivedStateFromError() {
    return { error: true }
  }

  render() {
    if (this.state.error) {
      return (
        <div
          className={cn(
            "flex min-h-64 flex-col items-center justify-center gap-3 rounded-xl border bg-muted/30 p-6 text-center text-sm text-muted-foreground",
            this.props.className
          )}
          role="alert"
        >
          <div>Couldn&apos;t load this PDF.</div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              this.setState((state) => ({
                error: false,
                retryKey: state.retryKey + 1,
              }))
            }
          >
            Retry
          </Button>
        </div>
      )
    }

    return (
      <React.Fragment key={this.state.retryKey}>
        {this.props.children}
      </React.Fragment>
    )
  }
}

function PdfToolbarSkeleton({
  showRailToggle = false,
}: {
  showRailToggle?: boolean
}) {
  return (
    <div className="flex h-10 flex-shrink-0 items-center gap-1 border-b bg-card px-2">
      {showRailToggle ? (
        <ToolbarIconPlaceholder>
          <PanelLeftClose />
        </ToolbarIconPlaceholder>
      ) : null}
      <span className="px-1">
        <Skeleton className="inline-block h-3 w-12 align-middle" />
      </span>
      <div className="ml-auto flex items-center gap-1">
        <ToolbarIconPlaceholder>
          <Minus />
        </ToolbarIconPlaceholder>
        <span className="w-12 text-center">
          <Skeleton className="inline-block h-3 w-8 align-middle" />
        </span>
        <ToolbarIconPlaceholder>
          <Plus />
        </ToolbarIconPlaceholder>
        <ToolbarIconPlaceholder>
          <Maximize />
        </ToolbarIconPlaceholder>
        <ToolbarIconPlaceholder>
          <RotateCw />
        </ToolbarIconPlaceholder>
        <Separator orientation="vertical" className="mx-1 h-4" />
        <ToolbarIconPlaceholder>
          <Download />
        </ToolbarIconPlaceholder>
      </div>
    </div>
  )
}

function ToolbarIconPlaceholder({ children }: { children: React.ReactNode }) {
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      className="size-7"
      disabled
      tabIndex={-1}
      aria-hidden
    >
      {children}
    </Button>
  )
}

function PageAspectSkeleton() {
  return (
    <Skeleton
      aria-hidden
      className="w-full rounded-md"
      style={{ aspectRatio: "8.5 / 11" }}
    />
  )
}
