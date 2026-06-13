import type { Metadata } from "next"

import { ScrollBenchClient } from "./scrollbench-client"

export const metadata: Metadata = {
  title: "Scrollbench",
  description: "Normalized scroll FPS harness for Retab viewers.",
}

export default async function ScrollBenchPage({
  searchParams,
}: {
  searchParams: Promise<{
    jumpOverscan?: string | string[]
    overscan?: string | string[]
    rows?: string | string[]
    viewer?: string | string[]
  }>
}) {
  const params = await searchParams
  const viewer = Array.isArray(params.viewer) ? params.viewer[0] : params.viewer
  return (
    <ScrollBenchClient
      initialJsonSettings={{
        jumpOverscan: firstParam(params.jumpOverscan),
        overscan: firstParam(params.overscan),
        rows: firstParam(params.rows),
      }}
      initialViewer={viewer}
    />
  )
}

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}
