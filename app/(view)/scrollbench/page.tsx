import type { Metadata } from "next"

import { ScrollBenchClient } from "./scrollbench-client"

export const metadata: Metadata = {
  title: "Scrollbench",
  description: "Normalized scroll FPS harness for Retab viewers.",
}

export default async function ScrollBenchPage({
  searchParams,
}: {
  searchParams: Promise<{ viewer?: string | string[] }>
}) {
  const params = await searchParams
  const viewer = Array.isArray(params.viewer) ? params.viewer[0] : params.viewer
  return <ScrollBenchClient initialViewer={viewer} />
}
