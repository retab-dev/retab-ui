import { type Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import {
  getViewerBlock,
  getViewerBlockTab,
  VIEWER_BLOCK_TABS,
} from "@/lib/viewer-blocks";
import {
  DOCUMENT_ANALYSIS_EXAMPLE_IDS,
  getExampleTab,
} from "@/lib/example-sections";
import { ViewerBlocks } from "@/components/viewer-blocks";

export const dynamic = "force-static";
export const revalidate = false;

export function generateStaticParams() {
  return [
    ...VIEWER_BLOCK_TABS.map((block) => ({ block: block.id })),
    ...DOCUMENT_ANALYSIS_EXAMPLE_IDS.map((id) => ({ block: id })),
  ];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ block: string }>;
}): Promise<Metadata> {
  const { block: blockId } = await params;
  const tab = getExampleTab(blockId);
  if (!tab) return {};

  const block = getViewerBlock(blockId);
  return {
    title: `${tab.title} Example`,
    description: block?.description,
  };
}

export default async function ExamplesPage({
  params,
}: {
  params: Promise<{ block: string }>;
}) {
  const { block: blockId } = await params;

  // Both sections render through ViewerBlocks; Document Analysis tabs are
  // non-standalone viewer blocks, so resolve them via getViewerBlock too.
  if (getExampleTab(blockId)) {
    const block = getViewerBlock(blockId);
    if (block) {
      return <ViewerBlocks blockId={block.id} />;
    }
  }

  // Non-tab example ids (composed inside another block) still redirect to docs.
  if (!getViewerBlockTab(blockId)) {
    const exampleBlock = getViewerBlock(blockId);
    if (exampleBlock?.isStandaloneTab === false) {
      redirect(exampleBlock.docsHref);
    }
  }

  notFound();
}
