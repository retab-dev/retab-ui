import { type Metadata } from "next"

import {
  PageHeader,
  PageHeaderDescription,
  PageHeaderHeading,
} from "@/components/page-header"
import { RetabSchemaBuilderDemo } from "@/components/retab-schema-builder-demo"
import { CsvViewerDemo } from "@/components/csv-viewer-demo"

export const metadata: Metadata = {
  title: "Components preview",
  description: "Live preview of the Retab schema builder and CSV viewer.",
}

export default function PreviewPage() {
  return (
    <div className="flex flex-1 flex-col">
      <PageHeader>
        <PageHeaderHeading className="max-w-4xl">
          Schema builder
        </PageHeaderHeading>
        <PageHeaderDescription>
          The Retab JSON schema editor, ported from the dashboard.
        </PageHeaderDescription>
      </PageHeader>
      <div className="container-wrapper flex-1">
        <div className="container flex flex-col gap-10 py-8">
          <RetabSchemaBuilderDemo />
          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold">CSV viewer</h2>
            <CsvViewerDemo />
          </section>
        </div>
      </div>
    </div>
  )
}
