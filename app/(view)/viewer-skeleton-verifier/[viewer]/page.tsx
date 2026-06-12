import type { Metadata } from "next"
import { notFound } from "next/navigation"

import fixtures from "../fixtures.json"
import { ViewerSkeletonVerifierClient } from "./viewer-skeleton-verifier-client"

export const metadata: Metadata = {
  title: "Viewer Skeleton Verifier",
  description: "Chromium fixture for viewer skeleton geometry.",
}

export default async function ViewerSkeletonVerifierPage(props: {
  params: Promise<{ viewer: string }>
  searchParams: Promise<{ run?: string }>
}) {
  const { viewer } = await props.params
  const { run } = await props.searchParams
  const fixture = fixtures.find((item) => item.id === viewer)
  if (!fixture) notFound()
  return <ViewerSkeletonVerifierClient fixture={fixture} runId={run} />
}
