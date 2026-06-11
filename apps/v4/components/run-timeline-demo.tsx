"use client"

import { RunTimelineBlock } from "@/registry/new-york-v4/blocks/run-timeline-block"

export function RunTimelineDemo() {
  return (
    <div
      className="not-prose flex flex-col overflow-hidden rounded-xl border"
      style={{ height: 560 }}
    >
      <RunTimelineBlock />
    </div>
  )
}
