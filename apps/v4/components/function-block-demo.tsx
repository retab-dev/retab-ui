"use client"

import { FunctionBlock } from "@/registry/new-york-v4/blocks/function-block"

export function FunctionBlockDemo() {
  return (
    <div
      className="not-prose flex flex-col overflow-hidden rounded-xl border"
      style={{ height: 520 }}
    >
      <FunctionBlock />
    </div>
  )
}
