"use client"

import { ExtractBlock } from "@/registry/new-york-v4/blocks/extract-block"

export function ExtractBlockDemo() {
  return (
    <div
      className="not-prose flex flex-col overflow-hidden rounded-xl border"
      style={{ height: 480 }}
    >
      <ExtractBlock />
    </div>
  )
}
