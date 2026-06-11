// Metadata for the document-viewer blocks showcased on /blocks. Each block id
// maps to a self-contained component (see components/viewer-blocks.tsx) and to a
// registry item named `<id>-viewer-block` (see registry.json), whose source
// files feed the Code view.

type ViewerBlockCategoryId =
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
    categories: ["primitives"],
  },
  {
    id: "parse",
    registryName: "parse-viewer-block",
    title: "Parse Viewer",
    description:
      "A parsed document the standard way — the source PDF beside its extracted markdown, synced by page, with a Rendered/Text toggle. Parsed markdown of the bank-statement sample.",
    command: getRegistryAddCommand("parse-viewer-block"),
    docsHref: "/docs/viewers/parse-viewer",
    viewHref: "/view/blocks/parse",
    featured: true,
    categories: ["primitives"],
  },
  {
    id: "extraction-viewer",
    registryName: "extraction-viewer-block",
    title: "Extraction Viewer",
    description:
      "Every extraction format in one viewer — PDF, image, text, CSV, Excel, and Word — each shown as a JSON form beside its source document, linked by their sources. Tabs switch the file format; hovering a form field highlights where its value came from. One useSourceLink mediator drives every viewer; only the viewer + its source adapter differ per tab.",
    command: getRegistryAddCommand("extraction-viewer-block"),
    docsHref: "/docs/components/extract-viewer",
    viewHref: "/view/blocks/extraction-viewer",
    featured: true,
    previewHeightClassName: "h-[724px]",
    categories: ["sources"],
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
    categories: [],
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
    categories: [],
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
    categories: [],
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
    categories: [],
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
    categories: [],
  },
  {
    id: "docx-sources",
    registryName: "docx-sources-block",
    title: "DOCX Sources",
    description:
      "Extracted values linked back into a Word document — hover a field to highlight its text and scroll to it. The source-link abstraction over the docx viewer, locating text spans by content match and table cells by index.",
    command: getRegistryAddCommand("docx-sources-block"),
    docsHref: "/docs/components/extract-viewer",
    viewHref: "/view/blocks/docx-sources",
    categories: [],
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
      "The split viewer shown with every legend placement — a 2×2 gallery over one attention.pdf split result: bar, floating, inset, and a vertical rail, all sharing one selection.",
    command: getRegistryAddCommand("legend-variants-block"),
    docsHref: "/docs/components/split-viewer",
    viewHref: "/view/blocks/legend-variants",
    categories: ["legends"],
  },
  {
    id: "pdf-thumbnails",
    registryName: "pdf-thumbnails-block",
    title: "PDF Thumbnails",
    description:
      "A PDF viewer with a toggleable page-thumbnail sidebar in the aside slot. Thumbnails render lazily as they scroll into view, highlight the current page, and jump on click.",
    command: getRegistryAddCommand("pdf-thumbnails-block"),
    docsHref: "/docs/viewers/pdf-viewer",
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
