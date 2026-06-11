"use client"

import * as React from "react"
import { Download } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

export class PptxErrorBoundary extends React.Component<
  {
    children: React.ReactNode
    className?: string
    src: string
    bare?: boolean
    downloadFileName?: string
    resetKey?: unknown
  },
  { error: boolean }
> {
  state = { error: false }

  componentDidUpdate(prev: { resetKey?: unknown }) {
    if (prev.resetKey !== this.props.resetKey && this.state.error) {
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
            "flex min-h-64 flex-col items-center justify-center gap-3 p-6 text-center text-sm text-muted-foreground",
            this.props.bare ? "bg-muted/20" : "rounded-xl border bg-muted/30",
            this.props.className
          )}
        >
          <div>Couldn&apos;t load this presentation.</div>
          <Button
            variant="outline"
            size="sm"
            render={
              <a
                href={this.props.src}
                download={this.props.downloadFileName}
                target="_blank"
                rel="noreferrer"
              />
            }
          >
            <Download />
            Download
          </Button>
        </div>
      )
    }
    return this.props.children
  }
}
