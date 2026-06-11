"use client"

import { ApiCallBlock } from "@/registry/new-york-v4/blocks/api-call-block"

export function ApiCallDemo() {
  return (
    <div
      className="not-prose flex flex-col overflow-hidden rounded-xl border"
      style={{ height: 520 }}
    >
      <ApiCallBlock />
    </div>
  )
}
