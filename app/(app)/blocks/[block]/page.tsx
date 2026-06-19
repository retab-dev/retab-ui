import { type Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import {
  getViewerBlock,
  getViewerBlockTab,
  VIEWER_BLOCK_TABS,
} from "@/lib/viewer-blocks";
import { ViewerBlocks } from "@/components/viewer-blocks";

export const dynamic = "force-static";
export const revalidate = false;

export function generateStaticParams() {
  return VIEWER_BLOCK_TABS.map((block) => ({ block: block.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ block: string }>;
}): Promise<Metadata> {
  const { block: blockId } = await params;
  const block = getViewerBlockTab(blockId);
  if (!block) return {};

  return {
    title: `${block.title} Block`,
    description: block.description,
  };
}

export default async function BlocksPage({
  params,
}: {
  params: Promise<{ block: string }>;
}) {
  const { block: blockId } = await params;
  const block = getViewerBlockTab(blockId);

  if (!block) {
    const exampleBlock = getViewerBlock(blockId);
    if (exampleBlock?.isStandaloneTab === false) {
      redirect(exampleBlock.docsHref);
    }
    notFound();
  }

  return <ViewerBlocks blockId={block.id} />;
}
