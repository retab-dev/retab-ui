// Metadata for the document-viewer examples showcased on /examples. Each block id
// maps to a self-contained component (see components/viewer-block-component-registry.tsx)
// and to a registry item named `<id>-viewer-block` (see registry.json), whose
// source files feed the Code view.

type ViewerBlockCategoryId =
  | "primitives"
  | "dropzone"
  | "file-system"
  | "run-cards";

type ViewerBlockConfig = {
  id: string;
  /** Registry item name — `pnpm dlx shadcn@latest add @retab/<registryName>`. */
  registryName: string;
  title: string;
  badge?: string;
  description: string;
  command: string;
  docsHref: string;
  viewHref: string;
  previewHeightClassName?: string;
  /** Surfaced under the "Featured" tab. */
  featured?: boolean;
  /** Category tabs this block appears under. */
  categories: ViewerBlockCategoryId[];
  /** Hide examples that are already composed inside another component block. */
  isStandaloneTab?: boolean;
};

function getRegistryAddCommand(name: string) {
  return `pnpm dlx shadcn@latest add @retab/${name}`;
}

export const VIEWER_BLOCKS = [
  {
    id: "ocr",
    registryName: "ocr-block",
    title: "OCR",
    description:
      "OCR review for a scanned document — source image on the left, detected text blocks on the right, and matching polygon overlays with confidence filtering.",
    command: getRegistryAddCommand("ocr-block"),
    docsHref: "/docs/components/layout-blocks",
    viewHref: "/view/blocks/ocr",
    featured: true,
    previewHeightClassName: "h-[680px]",
    categories: [],
  },
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
    docsHref: "/docs/components/parse-viewer",
    viewHref: "/view/blocks/parse",
    featured: true,
    categories: ["primitives"],
  },
  {
    id: "edit",
    registryName: "edit-viewer-block",
    title: "Edit Viewer",
    description:
      "Filled form fields beside the source document, linked by their bbox — hover or select a field to highlight its region on the page and scroll it into view, toggle Original/Filled to stamp each value into its box. A template-fill of the Fidelity bank-wire form (29 fields over 3 pages), built on the PDF viewer's renderPageOverlay and scrollToPageArea handle.",
    command: getRegistryAddCommand("edit-viewer-block"),
    docsHref: "/docs/components/edit-viewer",
    viewHref: "/view/blocks/edit",
    categories: ["primitives"],
  },
  {
    id: "sources-viewer",
    registryName: "sources-viewer-block",
    title: "Sources Viewer",
    description:
      "Every source-backed format in one viewer — PDF, image, text, CSV, Excel, and Word — each shown as a JSON form beside its source document. Tabs switch the file format; segmented source interaction drives hover, selection, and source navigation.",
    command: getRegistryAddCommand("sources-viewer-block"),
    docsHref: "/examples/sources-viewer",
    viewHref: "/view/blocks/sources-viewer",
    featured: true,
    previewHeightClassName: "h-[724px]",
    categories: ["primitives"],
  },
  {
    id: "extract",
    registryName: "extract-viewer-block",
    title: "Extract Viewer",
    description:
      "Extracted fields beside the source PDF, linked by their sources — hover or select a field to highlight where its value came from and scroll the page to it. Built on the document-source model and the PDF viewer's scrollToPageArea handle.",
    command: getRegistryAddCommand("extract-viewer-block"),
    docsHref: "/examples/sources-viewer",
    viewHref: "/view/blocks/extract",
    categories: [],
    isStandaloneTab: false,
  },
  {
    id: "image-sources",
    registryName: "image-sources-block",
    title: "Image Sources",
    description:
      "Extracted fields linked to a scanned page image — hover a field to highlight its image_bbox region. The source-link abstraction over the image viewer.",
    command: getRegistryAddCommand("image-sources-block"),
    docsHref: "/examples/sources-viewer",
    viewHref: "/view/blocks/image-sources",
    categories: [],
    isStandaloneTab: false,
  },
  {
    id: "text-sources",
    registryName: "text-sources-block",
    title: "Text Sources",
    description:
      "Values extracted from a log file linked to the lines they came from — hover a field to highlight its line range. The source-link abstraction over a line-based text viewer.",
    command: getRegistryAddCommand("text-sources-block"),
    docsHref: "/examples/sources-viewer",
    viewHref: "/view/blocks/text-sources",
    categories: [],
    isStandaloneTab: false,
  },
  {
    id: "csv-sources",
    registryName: "csv-sources-block",
    title: "CSV Sources",
    description:
      "Extracted values linked to spreadsheet cells — hover a field to highlight its cell and scroll to it. The source-link abstraction over the CSV viewer's cell handle.",
    command: getRegistryAddCommand("csv-sources-block"),
    docsHref: "/examples/sources-viewer",
    viewHref: "/view/blocks/csv-sources",
    categories: [],
    isStandaloneTab: false,
  },
  {
    id: "xlsx-sources",
    registryName: "xlsx-sources-block",
    title: "Excel Sources",
    description:
      "Extracted values linked to spreadsheet cells across sheets — hover a field to switch to its sheet, highlight the cell, and scroll to it. The source-link abstraction over the xlsx viewer.",
    command: getRegistryAddCommand("xlsx-sources-block"),
    docsHref: "/examples/sources-viewer",
    viewHref: "/view/blocks/xlsx-sources",
    categories: [],
    isStandaloneTab: false,
  },
  {
    id: "docx-sources",
    registryName: "docx-sources-block",
    title: "DOCX Sources",
    description:
      "Extracted values linked back into a Word document — hover a field to highlight its text and scroll to it. The source-link abstraction over the docx viewer, locating text spans by content match and table cells by index.",
    command: getRegistryAddCommand("docx-sources-block"),
    docsHref: "/examples/sources-viewer",
    viewHref: "/view/blocks/docx-sources",
    categories: [],
    isStandaloneTab: false,
  },
  {
    id: "json-form-sources",
    registryName: "json-form-sources-block",
    title: "JSON Form Sources",
    description:
      "Extraction rendered as a JSON form beside the source PDF — hover a form field to highlight where its value came from through segmented-document state.",
    command: getRegistryAddCommand("json-form-sources-block"),
    docsHref: "/examples/sources-viewer",
    viewHref: "/view/blocks/json-form-sources",
    previewHeightClassName: "h-[680px]",
    categories: ["primitives"],
    isStandaloneTab: false,
  },
  {
    id: "dropzone",
    registryName: "dropzone-block",
    title: "Dropzone",
    description:
      "A file-uploader lab with document, single PDF, image-only, size-limited, disabled, and callback-only dropzones sharing the same primitive.",
    command: getRegistryAddCommand("dropzone-block"),
    docsHref: "/docs/components/dropzone",
    viewHref: "/view/blocks/dropzone",
    previewHeightClassName: "h-[760px]",
    featured: true,
    categories: [],
    isStandaloneTab: false,
  },
  {
    id: "dropzone-file-uploader",
    registryName: "dropzone-file-uploader-example",
    title: "Default File Uploader",
    description:
      "The standard visual file uploader built on the headless dropzone primitive.",
    command: getRegistryAddCommand("dropzone-file-uploader-example"),
    docsHref: "/docs/components/dropzone",
    viewHref: "/view/blocks/dropzone-file-uploader",
    previewHeightClassName: "h-[440px]",
    categories: ["dropzone"],
    isStandaloneTab: false,
  },
  {
    id: "dropzone-file-viewer",
    registryName: "dropzone-file-viewer-example",
    title: "Uploader + Viewer",
    description:
      "One upload surface that becomes a file viewer, with the uploaded blob rendered by FileViewer.",
    command: getRegistryAddCommand("dropzone-file-viewer-example"),
    docsHref: "/docs/components/dropzone",
    viewHref: "/view/blocks/dropzone-file-viewer",
    previewHeightClassName: "h-[560px]",
    categories: ["dropzone"],
    isStandaloneTab: false,
  },
  {
    id: "dropzone-non-button-trigger",
    registryName: "dropzone-non-button-trigger",
    title: "Non-Button Trigger",
    description:
      "A custom element opens the file dialog while preserving dropzone state.",
    command: getRegistryAddCommand("dropzone-non-button-trigger"),
    docsHref: "/docs/components/dropzone",
    viewHref: "/view/blocks/dropzone-non-button-trigger",
    previewHeightClassName: "h-[260px]",
    categories: ["dropzone"],
    isStandaloneTab: false,
  },
  {
    id: "dropzone-native-button-queue",
    registryName: "dropzone-native-button-queue",
    title: "Native Button Queue",
    description:
      "A real button trigger with browser button semantics and a small selected-file queue.",
    command: getRegistryAddCommand("dropzone-native-button-queue"),
    docsHref: "/docs/components/dropzone",
    viewHref: "/view/blocks/dropzone-native-button-queue",
    previewHeightClassName: "h-[260px]",
    categories: ["dropzone"],
    isStandaloneTab: false,
  },
  {
    id: "dropzone-controlled-queue",
    registryName: "dropzone-controlled-queue",
    title: "Controlled Queue",
    description:
      "Parent-owned file state with controlled selected files and explicit clear behavior.",
    command: getRegistryAddCommand("dropzone-controlled-queue"),
    docsHref: "/docs/components/dropzone",
    viewHref: "/view/blocks/dropzone-controlled-queue",
    previewHeightClassName: "h-[260px]",
    categories: ["dropzone"],
    isStandaloneTab: false,
  },
  {
    id: "dropzone-validation-only",
    registryName: "dropzone-validation-only",
    title: "Validation Only",
    description:
      "Validate accepted files and rejection details without storing selected files.",
    command: getRegistryAddCommand("dropzone-validation-only"),
    docsHref: "/docs/components/dropzone",
    viewHref: "/view/blocks/dropzone-validation-only",
    previewHeightClassName: "h-[260px]",
    categories: ["dropzone"],
    isStandaloneTab: false,
  },
  {
    id: "dropzone-custom-thumbnail-grid",
    registryName: "dropzone-custom-thumbnail-grid",
    title: "Custom Thumbnail Grid",
    description:
      "Direct useDropzone composition with FileThumbnail previews in a custom grid.",
    command: getRegistryAddCommand("dropzone-custom-thumbnail-grid"),
    docsHref: "/docs/components/dropzone",
    viewHref: "/view/blocks/dropzone-custom-thumbnail-grid",
    previewHeightClassName: "h-[360px]",
    categories: ["dropzone"],
    isStandaloneTab: false,
  },
  {
    id: "dropzone-media-transcript-queue",
    registryName: "dropzone-media-transcript-queue",
    title: "Media Transcript Queue",
    description:
      "Audio and video files queued as transcript jobs with per-file thumbnails.",
    command: getRegistryAddCommand("dropzone-media-transcript-queue"),
    docsHref: "/docs/components/dropzone",
    viewHref: "/view/blocks/dropzone-media-transcript-queue",
    previewHeightClassName: "h-[360px]",
    categories: ["dropzone"],
    isStandaloneTab: false,
  },
  {
    id: "dropzone-upload-progress-queue",
    registryName: "dropzone-upload-progress-queue",
    title: "Upload Progress Queue",
    description:
      "A dropzone-backed upload queue with per-file loading bars keyed by the admitted file ids.",
    command: getRegistryAddCommand("dropzone-upload-progress-queue"),
    docsHref: "/docs/components/dropzone",
    viewHref: "/view/blocks/dropzone-upload-progress-queue",
    previewHeightClassName: "h-[360px]",
    categories: ["dropzone"],
    isStandaloneTab: false,
  },
  {
    id: "dropzone-avatar-image-slot",
    registryName: "dropzone-avatar-image-slot",
    title: "Avatar Image Slot",
    description:
      "A single replaceable image slot with a custom circular preview.",
    command: getRegistryAddCommand("dropzone-avatar-image-slot"),
    docsHref: "/docs/components/dropzone",
    viewHref: "/view/blocks/dropzone-avatar-image-slot",
    previewHeightClassName: "h-[360px]",
    categories: ["dropzone"],
    isStandaloneTab: false,
  },
  {
    id: "dropzone-spreadsheet-import",
    registryName: "dropzone-spreadsheet-import-card",
    title: "Spreadsheet Import",
    description: "A single spreadsheet upload feeding a mapping workflow.",
    command: getRegistryAddCommand("dropzone-spreadsheet-import-card"),
    docsHref: "/docs/components/dropzone",
    viewHref: "/view/blocks/dropzone-spreadsheet-import",
    previewHeightClassName: "h-[360px]",
    categories: ["dropzone"],
    isStandaloneTab: false,
  },
  {
    id: "dropzone-evidence-timeline",
    registryName: "dropzone-evidence-timeline",
    title: "Evidence Timeline",
    description:
      "Files become ordered evidence events inside a custom surface.",
    command: getRegistryAddCommand("dropzone-evidence-timeline"),
    docsHref: "/docs/components/dropzone",
    viewHref: "/view/blocks/dropzone-evidence-timeline",
    previewHeightClassName: "h-[380px]",
    categories: ["dropzone"],
    isStandaloneTab: false,
  },
  {
    id: "dropzone-comparison-pair",
    registryName: "dropzone-comparison-pair-upload",
    title: "Comparison Pair",
    description:
      "Two independent dropzones model original versus revision documents.",
    command: getRegistryAddCommand("dropzone-comparison-pair-upload"),
    docsHref: "/docs/components/dropzone",
    viewHref: "/view/blocks/dropzone-comparison-pair",
    previewHeightClassName: "h-[340px]",
    categories: ["dropzone"],
    isStandaloneTab: false,
  },
  {
    id: "dropzone-intake-router",
    registryName: "dropzone-intake-router",
    title: "Intake Router",
    description:
      "One intake target routes selected files into document, image, and table lanes.",
    command: getRegistryAddCommand("dropzone-intake-router"),
    docsHref: "/docs/components/dropzone",
    viewHref: "/view/blocks/dropzone-intake-router",
    previewHeightClassName: "h-[420px]",
    categories: ["dropzone"],
    isStandaloneTab: false,
  },
  {
    id: "dropzone-required-packet",
    registryName: "dropzone-required-packet-slots",
    title: "Required Packet",
    description: "Slot-level dropzones for checklist-driven packet collection.",
    command: getRegistryAddCommand("dropzone-required-packet-slots"),
    docsHref: "/docs/components/dropzone",
    viewHref: "/view/blocks/dropzone-required-packet",
    previewHeightClassName: "h-[360px]",
    categories: ["dropzone"],
    isStandaloneTab: false,
  },
  {
    id: "dropzone-pinboard",
    registryName: "dropzone-pinboard-drop-surface",
    title: "Pinboard Drop Surface",
    description: "A full canvas trigger that pins dropped files as cards.",
    command: getRegistryAddCommand("dropzone-pinboard-drop-surface"),
    docsHref: "/docs/components/dropzone",
    viewHref: "/view/blocks/dropzone-pinboard",
    previewHeightClassName: "h-[420px]",
    categories: ["dropzone"],
    isStandaloneTab: false,
  },
  {
    id: "dropzone-disabled",
    registryName: "dropzone-disabled-dropzone",
    title: "Disabled Dropzone",
    description: "Disabled input, trigger focus, intake, and drag behavior.",
    command: getRegistryAddCommand("dropzone-disabled-dropzone"),
    docsHref: "/docs/components/dropzone",
    viewHref: "/view/blocks/dropzone-disabled",
    previewHeightClassName: "h-[260px]",
    categories: ["dropzone"],
    isStandaloneTab: false,
  },
  {
    id: "file-system",
    registryName: "file-system-block",
    title: "File System",
    description:
      "A document workspace over a flat object-store manifest — list, grid, columns, and gallery views share selection, lazy folders, generated thumbnails, and a persistent FileViewer preview.",
    command: getRegistryAddCommand("file-system-block"),
    docsHref: "/docs/components/file-system",
    viewHref: "/view/blocks/file-system",
    previewHeightClassName: "h-[680px]",
    featured: true,
    categories: ["file-system"],
  },
  {
    id: "fslight",
    registryName: "fslight-block",
    title: "File System Light",
    description:
      "A purified composition experiment: Pierre's file tree in a ViewerSidebar, with the selected source rendered by FileViewer in the ViewerSurface.",
    command: getRegistryAddCommand("fslight-block"),
    docsHref: "/examples/file-system",
    viewHref: "/view/blocks/fslight",
    previewHeightClassName: "h-[680px]",
    categories: ["file-system"],
    isStandaloneTab: false,
  },
  {
    id: "primitive-cards",
    registryName: "primitive-cards-block",
    title: "Primitive Run Cards",
    description:
      "Each Retab primitive's result framed as a run card — a document thumbnail with a status pill and the primitive's output in the card body. Classification shows the page with its category and reasoning; split a mini page rail of color-keyed subdocuments; partition a keyed-chunk legend with an overlap ribbon; parse the page rendered as markdown; extract the page with each field's source box drawn over it. Composes the RunCard shell with per-primitive rendering over the shared segments model.",
    command: getRegistryAddCommand("primitive-cards-block"),
    docsHref: "/docs/components/file-thumbnail",
    viewHref: "/view/blocks/primitive-cards",
    featured: true,
    categories: ["run-cards"],
    isStandaloneTab: false,
  },
  {
    id: "pdf-thumbnails",
    registryName: "pdf-thumbnails-block",
    title: "PDF Thumbnails",
    description:
      "A PDF viewer with a toggleable page-thumbnail sidebar in the aside slot. Thumbnails render lazily as they scroll into view, highlight the current page, and jump on click.",
    command: getRegistryAddCommand("pdf-thumbnails-block"),
    docsHref: "/docs/components/file-viewer/renderers/pdf",
    viewHref: "/view/blocks/pdf-thumbnails",
    featured: true,
    categories: [],
  },
] as const satisfies readonly ViewerBlockConfig[];

export type ViewerBlockId = (typeof VIEWER_BLOCKS)[number]["id"];
export type ViewerBlockMetadata = ViewerBlockConfig & { id: ViewerBlockId };

function isStandaloneViewerBlockTab(block: ViewerBlockConfig) {
  return block.isStandaloneTab !== false;
}

export const VIEWER_BLOCK_TABS = VIEWER_BLOCKS.filter(
  (block): block is (typeof VIEWER_BLOCKS)[number] =>
    isStandaloneViewerBlockTab(block),
);

export const DEFAULT_VIEWER_BLOCK_TAB_ID = VIEWER_BLOCK_TABS[0]!.id;

export function getViewerBlock(
  blockId: string,
): ViewerBlockMetadata | undefined {
  return VIEWER_BLOCKS.find((block) => block.id === blockId);
}

export function getViewerBlockTab(
  blockId: string,
): ViewerBlockMetadata | undefined {
  return VIEWER_BLOCK_TABS.find((block) => block.id === blockId);
}

export function getViewerBlockHrefForRegistryName(registryName: string) {
  const block = VIEWER_BLOCKS.find(
    (item) => item.registryName === registryName,
  );
  if (!block) return "/examples";
  const metadata: ViewerBlockConfig = block;
  if (metadata.isStandaloneTab === false) {
    return metadata.docsHref;
  }
  return `/examples/${block.id}`;
}
