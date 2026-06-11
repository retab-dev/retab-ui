import { FileThumbnailFormatsGrid } from "@/components/file-thumbnail-formats-demo"
import { FileViewerDemo } from "@/components/file-viewer-demo"
import { JsonFormDemo } from "@/components/json-form-demo"
import { JsonTableDemo } from "@/components/json-table/json-table-demo"
import { RetabSchemaBuilderDemo } from "@/components/retab-schema-builder-demo"
import { JsonFormSourcesBlock } from "@/registry/new-york-v4/blocks/json-form-sources-block"

function ShowcaseItem({
  title,
  description,
  className,
  children,
}: {
  title: string
  description: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={`flex flex-col gap-3 ${className ?? ""}`}>
      <div className="space-y-1">
        <h3 className="text-sm font-medium text-foreground">{title}</h3>
        <p className="text-sm text-pretty text-muted-foreground">
          {description}
        </p>
      </div>
      {children}
    </div>
  )
}

/**
 * Home showcase grid.
 *
 * Two-column layout (single column on mobile), one primitive per cell:
 *   row 1 — Schema Builder · File Viewer
 *   row 2 — File Thumbnail · JSON Form
 *   row 3 — JSON Table     · Sources
 *
 * `items-start` keeps each cell top-aligned so cards keep their natural height
 * instead of stretching to the tallest sibling in the row.
 */
export function HomeShowcase() {
  return (
    <div className="container-wrapper">
      <div className="container px-6 pb-12 md:pb-16 lg:pb-20">
        {/* Floating island — the demos fade into the page. */}
        <div className="relative isolate overflow-hidden rounded-3xl px-4 py-10 sm:px-8 md:p-12">
          <div className="relative z-10 flex flex-col gap-8">
            <div className="grid items-start gap-8 md:grid-cols-2">
              <ShowcaseItem
                title="Schema Builder"
                description="Visual JSON Schema editor for shaping the structure your extractions follow."
              >
                <RetabSchemaBuilderDemo showJsonTab={false} />
              </ShowcaseItem>

              <ShowcaseItem
                title="File Viewer"
                description="One viewer for PDFs, images, and Office files — paged, zoomable, downloadable."
              >
                <FileViewerDemo />
              </ShowcaseItem>

              <ShowcaseItem
                title="File Thumbnail"
                description="Real first-page previews for PDFs, Office files, images, and text — rendered client-side."
              >
                <div className="overflow-hidden rounded-xl border shadow-sm">
                  <FileThumbnailFormatsGrid />
                </div>
              </ShowcaseItem>

              <ShowcaseItem
                title="JSON Form Field"
                description="Schema-driven, virtualized form fields that stay responsive across thousands of fields."
              >
                <JsonFormDemo showJsonTab={false} />
              </ShowcaseItem>
            </div>

            {/* Row 3 — JSON Table (2/5) · Sources (3/5) */}
            <div className="grid items-start gap-8 md:grid-cols-5">
              <ShowcaseItem
                className="md:col-span-2"
                title="JSON Table"
                description="Renders JSONs inside virtualized tables."
              >
                <JsonTableDemo />
              </ShowcaseItem>

              <ShowcaseItem
                className="md:col-span-3"
                title="Sources"
                description="Field-to-source linking: hover a value to highlight where it came from in the document."
              >
                <div className="h-[680px] overflow-hidden rounded-xl border shadow-sm">
                  <JsonFormSourcesBlock />
                </div>
              </ShowcaseItem>
            </div>
          </div>

          {/* Soft edges — fade the island into the page background. */}
          <div className="pointer-events-none absolute inset-x-0 top-0 z-20 h-24 bg-gradient-to-b from-background to-transparent" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-20 bg-gradient-to-t from-background to-transparent" />
        </div>
      </div>
    </div>
  )
}
