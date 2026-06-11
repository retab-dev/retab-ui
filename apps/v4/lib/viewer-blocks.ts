// Metadata for the document-viewer blocks showcased on /blocks. Each block id
// maps to a self-contained component (see components/viewer-blocks.tsx) and to a
// registry item named `<id>-viewer-block` (see registry.json), whose source
// files feed the Code view.

type ViewerBlockCategoryId = "documents" | "primitives" | "workflows"

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
  { id: "primitives", label: "Primitives" },
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
      "A parsed document the standard way — the source PDF beside its extracted markdown, synced by page, with a Rendered/Text toggle. Real Retab parse output of tapstone.pdf.",
    command: getRegistryAddCommand("parse-viewer-block"),
    docsHref: "/docs/components/parse-viewer",
    viewHref: "/view/blocks/parse",
    featured: true,
    categories: ["primitives"],
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
