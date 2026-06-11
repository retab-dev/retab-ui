import { type Metadata } from "next"

import {
  PageHeader,
  PageHeaderDescription,
  PageHeaderHeading,
} from "@/components/page-header"
import { getLoadedBlockCodeFileManifest } from "@/lib/block-code-samples"
import { ViewerBlocks } from "@/components/viewer-blocks"

export const dynamic = "force-static"
export const revalidate = false

export const metadata: Metadata = {
  title: "Blocks",
  description:
    "Document-viewer blocks built from the shared segment primitives — split, partition, and classification, each with preview + source.",
}

export default async function BlocksPage() {
  const codeSamples = await getLoadedBlockCodeFileManifest()

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader>
        <PageHeaderHeading className="max-w-4xl">Viewer blocks</PageHeaderHeading>
        <PageHeaderDescription>
          Document viewers composed from the shared file + sidebar + legend
          primitives. Toggle Preview / Code, resize the viewport, or copy the
          install command.
        </PageHeaderDescription>
      </PageHeader>
      <div className="container-wrapper flex-1">
        <div className="container py-8">
          <ViewerBlocks codeSamples={codeSamples} />
        </div>
      </div>
    </div>
  )
}
