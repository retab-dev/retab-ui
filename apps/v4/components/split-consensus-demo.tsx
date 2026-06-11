"use client"

import { SplitConsensusBlock } from "@/registry/new-york-v4/blocks/split-consensus-block"

export function SplitConsensusDemo() {
  return (
    <div className="not-prose flex flex-col overflow-hidden rounded-xl border">
      <SplitConsensusBlock />
    </div>
  )
}
