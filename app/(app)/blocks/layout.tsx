import {
  PageHeader,
  PageHeaderDescription,
  PageHeaderHeading,
} from "@/components/page-header"
import { ViewerBlockTabs } from "@/components/viewer-blocks"

export default function BlocksLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-1 flex-col">
      <PageHeader>
        <PageHeaderHeading className="max-w-4xl">
          Viewer blocks
        </PageHeaderHeading>
        <PageHeaderDescription>
          Document viewers composed from shared file, source, sidebar, and
          legend primitives. Toggle Preview / Code, resize the viewport, or copy
          the install command.
        </PageHeaderDescription>
      </PageHeader>
      <div className="container-wrapper flex-1">
        <div className="container max-w-5xl space-y-8 py-8">
          <ViewerBlockTabs />
          {children}
        </div>
      </div>
    </div>
  )
}
