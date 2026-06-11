"use client"

import { ConditionalBlock } from "@/registry/new-york-v4/blocks/conditional-block"

export function ConditionalBlockDemo() {
  return (
    <div
      className="not-prose flex flex-col overflow-hidden rounded-xl border"
      style={{ height: 520 }}
    >
      <ConditionalBlock />
    </div>
  )
}
