"use client"

import documentAiOutput from "@/sample/documentai-output.json"

import { DocumentAiLayoutBlocks } from "@/components/ui/layout-blocks"

export function DocumentAiLayoutBlocksDemo() {
  return <DocumentAiLayoutBlocks output={documentAiOutput} />
}
