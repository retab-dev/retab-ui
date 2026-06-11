// Metadata for the document-viewer blocks showcased on /blocks. Each block id
// maps to a self-contained component (see components/viewer-blocks.tsx) and to a
// registry item named `<id>-viewer-block` (see registry.json), whose source
// files feed the Code view.

type ViewerBlockCategoryId =
  | "documents"
  | "primitives"
  | "sources"
  | "legends"
  | "run-cards"
  | "workflows"

type ViewerBlockConfig = {
  id: string
  /** Registry item name — `pnpm dlx shadcn@latest add @retab/<registryName>`. */
  registryName: string
  title: string
  badge?: string
  description: string
  command: string
  docsHref: string
  viewHref: string
  previewHeightClassName?: string
  /** Surfaced under the "Featured" tab. */
  featured?: boolean
  /** Category tabs this block appears under. */
  categories: ViewerBlockCategoryId[]
}

/** The filter tabs shown above the blocks (shadcn-style). */
export const VIEWER_BLOCK_CATEGORIES = [
  { id: "featured", label: "Featured" },
  { id: "documents", label: "Documents" },
  { id: "sources", label: "Sources" },
  { id: "primitives", label: "Primitives" },
  { id: "legends", label: "Legends" },
  { id: "run-cards", label: "Run Cards" },
  { id: "workflows", label: "Workflows" },
] as const

export type ViewerBlockCategoryTabId =
  (typeof VIEWER_BLOCK_CATEGORIES)[number]["id"]

function getRegistryAddCommand(name: string) {
  return `pnpm dlx shadcn@latest add @retab/${name}`
}

export const VIEWER_BLOCKS = [
  {
    id: "split",
    registryName: "split-viewer-block",
    title: "Split Viewer",
    description:
      "Named subdocuments over a PDF — a legend header and a vertical page-ribbon sidebar, built from the shared segment primitives.",
    command: getRegistryAddCommand("split-viewer-block"),
    docsHref: "/docs/components/split-viewer",
    viewHref: "/view/blocks/split",
    featured: true,
    categories: ["primitives"],
  },
  {
    id: "partition",
    registryName: "partition-viewer-block",
    title: "Partition Viewer",
    description:
      "Keyed chunks over a PDF — a legend plus a horizontal page-ribbon waterfall that tracks scroll, from the same segment primitives.",
    command: getRegistryAddCommand("partition-viewer-block"),
    docsHref: "/docs/components/partition-viewer",
    viewHref: "/view/blocks/partition",
    featured: true,
    categories: ["primitives"],
  },
  {
    id: "classification",
    registryName: "classification-viewer-block",
    title: "Classification Viewer",
    description:
      "A single category over a PDF, shown as one segment in the legend — the same file + legend system with a single segment.",
    command: getRegistryAddCommand("classification-viewer-block"),
    docsHref: "/docs/components/classification-viewer",
    viewHref: "/view/blocks/classification",
    featured: true,
    categories: ["primitives"],
  },
  {
    id: "parse",
    registryName: "parse-viewer-block",
    title: "Parse Viewer",
    description:
      "A parsed document the standard way — the source PDF beside its extracted markdown, synced by page, with a Rendered/Text toggle. Parsed markdown of the bank-statement sample.",
    command: getRegistryAddCommand("parse-viewer-block"),
    docsHref: "/docs/components/parse-viewer",
    viewHref: "/view/blocks/parse",
    featured: true,
    categories: ["primitives"],
  },
  {
    id: "extract",
    registryName: "extract-viewer-block",
    title: "Extract Viewer",
    description:
      "Extracted fields beside the source PDF, linked by their sources — hover or select a field to highlight where its value came from and scroll the page to it. Built on the document-source model and the PDF viewer's scrollToPageArea handle.",
    command: getRegistryAddCommand("extract-viewer-block"),
    docsHref: "/docs/components/extract-viewer",
    viewHref: "/view/blocks/extract",
    featured: true,
    categories: ["sources"],
  },
  {
    id: "json-form-sources",
    registryName: "json-form-sources-block",
    title: "JSON Form Sources",
    description:
      "Extraction rendered as a JSON form beside the source PDF — hover a form field to highlight where its value came from. Composes json-form and the PDF viewer through useSourceLink; source data is the Retab /v1/extractions/{id}/sources response.",
    command: getRegistryAddCommand("json-form-sources-block"),
    docsHref: "/docs/components/extract-viewer",
    viewHref: "/view/blocks/json-form-sources",
    featured: true,
    categories: ["sources"],
  },
  {
    id: "image-sources",
    registryName: "image-sources-block",
    title: "Image Sources",
    description:
      "Extracted fields linked to a scanned page image — hover a field to highlight its image_bbox region. The source-link abstraction over the image viewer.",
    command: getRegistryAddCommand("image-sources-block"),
    docsHref: "/docs/components/extract-viewer",
    viewHref: "/view/blocks/image-sources",
    categories: ["sources"],
  },
  {
    id: "text-sources",
    registryName: "text-sources-block",
    title: "Text Sources",
    description:
      "Values extracted from a log file linked to the lines they came from — hover a field to highlight its line range. The source-link abstraction over a line-based text viewer.",
    command: getRegistryAddCommand("text-sources-block"),
    docsHref: "/docs/components/extract-viewer",
    viewHref: "/view/blocks/text-sources",
    categories: ["sources"],
  },
  {
    id: "csv-sources",
    registryName: "csv-sources-block",
    title: "CSV Sources",
    description:
      "Extracted values linked to spreadsheet cells — hover a field to highlight its cell and scroll to it. The source-link abstraction over the CSV viewer's cell handle.",
    command: getRegistryAddCommand("csv-sources-block"),
    docsHref: "/docs/components/extract-viewer",
    viewHref: "/view/blocks/csv-sources",
    categories: ["sources"],
  },
  {
    id: "xlsx-sources",
    registryName: "xlsx-sources-block",
    title: "Excel Sources",
    description:
      "Extracted values linked to spreadsheet cells across sheets — hover a field to switch to its sheet, highlight the cell, and scroll to it. The source-link abstraction over the xlsx viewer.",
    command: getRegistryAddCommand("xlsx-sources-block"),
    docsHref: "/docs/components/extract-viewer",
    viewHref: "/view/blocks/xlsx-sources",
    categories: ["sources"],
  },
  {
    id: "primitive-cards",
    registryName: "primitive-cards-block",
    title: "Primitive Run Cards",
    description:
      "Each primitive's result framed as a run card — a document thumbnail with a status pill and the primitive's output in the body. Classification shows one thumbnail; a split swaps it for a bundle of much smaller per-subdocument FileThumbnails, color-keyed to the legend. Composes the RunCard shell with per-primitive rendering.",
    command: getRegistryAddCommand("primitive-cards-block"),
    docsHref: "/docs/components/file-thumbnail",
    viewHref: "/view/blocks/primitive-cards",
    featured: true,
    categories: ["run-cards"],
  },
  {
    id: "legend-variants",
    registryName: "legend-variants-block",
    title: "Legend Variants",
    description:
      "Every legend placement — bar, floating, inset, and a vertical rail — shown on the real split and partition document with page color overlays. One SegmentLegend drives each panel; only variant/orientation/side differ, and a shared selection dims the matching pages across all four at once.",
    command: getRegistryAddCommand("legend-variants-block"),
    docsHref: "/docs/components/segmented-viewer",
    viewHref: "/view/blocks/legend-variants",
    categories: ["legends", "primitives"],
  },
  {
    id: "pdf-thumbnails",
    registryName: "pdf-thumbnails-block",
    title: "PDF Thumbnails",
    description:
      "A PDF viewer with a toggleable page-thumbnail sidebar in the aside slot. Thumbnails render lazily as they scroll into view, highlight the current page, and jump on click.",
    command: getRegistryAddCommand("pdf-thumbnails-block"),
    docsHref: "/docs/components/pdf-viewer",
    viewHref: "/view/blocks/pdf-thumbnails",
    featured: true,
    categories: ["primitives"],
  },
] as const satisfies readonly ViewerBlockConfig[]

export type ViewerBlockId = (typeof VIEWER_BLOCKS)[number]["id"]
export type ViewerBlockMetadata = ViewerBlockConfig & { id: ViewerBlockId }

export function getViewerBlock(blockId: string): ViewerBlockMetadata | undefined {
  return VIEWER_BLOCKS.find((block) => block.id === blockId)
}
