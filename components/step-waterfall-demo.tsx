"use client"

import { StepWaterfallBlock } from "@/registry/new-york-v4/blocks/step-waterfall-block"

export function StepWaterfallDemo() {
  return (
    <div
      className="not-prose flex flex-col overflow-hidden rounded-xl border"
      style={{ height: 420 }}
    >
      <StepWaterfallBlock />
    </div>
  )
}
