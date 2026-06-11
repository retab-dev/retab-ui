import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { getViewerBlock, VIEWER_BLOCKS } from "@/lib/viewer-blocks"
import { ViewerBlockFullscreen } from "@/components/viewer-block-fullscreen"

export const dynamic = "force-static"
export const dynamicParams = false
export const revalidate = false

export function generateStaticParams() {
  return VIEWER_BLOCKS.map((block) => ({ block: block.id }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ block: string }>
}): Promise<Metadata> {
  const { block: blockId } = await params
  const block = getViewerBlock(blockId)
  if (!block) return {}
  return { title: block.title, description: block.description }
}

export default async function BlockViewPage({
  params,
}: {
  params: Promise<{ block: string }>
}) {
  const { block: blockId } = await params
  const block = getViewerBlock(blockId)
  if (!block) notFound()
  return <ViewerBlockFullscreen blockId={block.id} />
}
