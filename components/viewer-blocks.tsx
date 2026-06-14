"use client"

import * as React from "react"
import Link from "next/link"
import { Code, FileCode, Loader2, Terminal } from "lucide-react"

import { cn } from "@/lib/utils"
import {
  VIEWER_BLOCK_CATEGORIES,
  VIEWER_BLOCKS,
  type ViewerBlockCategoryTabId,
  type ViewerBlockId,
  type ViewerBlockMetadata,
} from "@/lib/viewer-blocks"
import { useMediaQuery } from "@/hooks/use-media-query"
import { useMounted } from "@/hooks/use-mounted"
import { Button } from "@/components/ui/button"
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
} from "@/components/ui/navigation-menu"
import {
  CodeHeaderCopyButton,
  CopyButtonIcon,
  copyToClipboardWithMeta,
} from "@/components/copy-button"
import { HighlightedCodeBlock } from "@/components/highlighted-code-block"
import { CsvSourcesBlock } from "@/registry/new-york-v4/blocks/csv-sources-block"
import { DocxSourcesBlock } from "@/registry/new-york-v4/blocks/docx-sources-block"
import { AvatarImageSlot } from "@/registry/new-york-v4/blocks/dropzone-avatar-image-slot"
import { DropzoneBlock } from "@/registry/new-york-v4/blocks/dropzone-block"
import { ComparisonPairUpload } from "@/registry/new-york-v4/blocks/dropzone-comparison-pair-upload"
import { ControlledQueue } from "@/registry/new-york-v4/blocks/dropzone-controlled-queue"
import { CustomThumbnailGrid } from "@/registry/new-york-v4/blocks/dropzone-custom-thumbnail-grid"
import { DisabledDropzone } from "@/registry/new-york-v4/blocks/dropzone-disabled-dropzone"
import { EvidenceTimeline } from "@/registry/new-york-v4/blocks/dropzone-evidence-timeline"
import { DefaultFileUploaderExample } from "@/registry/new-york-v4/blocks/dropzone-file-uploader-example"
import { DropzoneFileViewerExample } from "@/registry/new-york-v4/blocks/dropzone-file-viewer-example"
import { IntakeRouter } from "@/registry/new-york-v4/blocks/dropzone-intake-router"
import { MediaTranscriptQueue } from "@/registry/new-york-v4/blocks/dropzone-media-transcript-queue"
import { NativeButtonQueue } from "@/registry/new-york-v4/blocks/dropzone-native-button-queue"
import { NonButtonTrigger } from "@/registry/new-york-v4/blocks/dropzone-non-button-trigger"
import { PinboardDropSurface } from "@/registry/new-york-v4/blocks/dropzone-pinboard-drop-surface"
import { RequiredPacketSlots } from "@/registry/new-york-v4/blocks/dropzone-required-packet-slots"
import { SpreadsheetImportCard } from "@/registry/new-york-v4/blocks/dropzone-spreadsheet-import-card"
import { ValidationOnly } from "@/registry/new-york-v4/blocks/dropzone-validation-only"
import { EditViewerBlock } from "@/registry/new-york-v4/blocks/edit-viewer-block"
import { ExtractViewerBlock } from "@/registry/new-york-v4/blocks/extract-viewer-block"
import { ExtractionViewerBlock } from "@/registry/new-york-v4/blocks/extraction-viewer-block"
import { FileSystemBlock } from "@/registry/new-york-v4/blocks/file-system-block"
import { FsLightBlock } from "@/registry/new-york-v4/blocks/fslight-block"
import { ImageSourcesBlock } from "@/registry/new-york-v4/blocks/image-sources-block"
import { LegendVariantsBlock } from "@/registry/new-york-v4/blocks/legend-variants-block"
import { OcrBlock } from "@/registry/new-york-v4/blocks/ocr-block"
import { ParseViewerBlock } from "@/registry/new-york-v4/blocks/parse-viewer-block"
import { PartitionViewerBlock } from "@/registry/new-york-v4/blocks/partition-viewer-block"
import { PdfThumbnailsBlock } from "@/registry/new-york-v4/blocks/pdf-thumbnails-block"
import { PrimitiveCardsBlock } from "@/registry/new-york-v4/blocks/primitive-cards-block"
import { SplitViewerBlock } from "@/registry/new-york-v4/blocks/split-viewer-block"
import { TextSourcesBlock } from "@/registry/new-york-v4/blocks/text-sources-block"
import { XlsxSourcesBlock } from "@/registry/new-york-v4/blocks/xlsx-sources-block"

type BlockCodeSample = {
  sourcePath: string
  targetPath: string
  language: string
  content: string
  lineCount: number
}

type BlockCodeSamplesState =
  | { status: "idle"; codeSamples: BlockCodeSample[]; error?: undefined }
  | { status: "loading"; codeSamples: BlockCodeSample[]; error?: undefined }
  | { status: "ready"; codeSamples: BlockCodeSample[]; error?: undefined }
  | { status: "error"; codeSamples: BlockCodeSample[]; error: string }

type ViewerBlock = ViewerBlockMetadata & { component: React.ComponentType }

type BlockView = "preview" | "code"

const BLOCK_VIEWPORT_HEIGHT_CLASS = "h-[680px]"
const BLOCK_PREVIEW_LAZY_ROOT_MARGIN = "900px 0px"
const BLOCK_CATEGORY_HASH_PREFIX = "category-"

const blockComponents = {
  ocr: OcrBlock,
  split: SplitViewerBlock,
  partition: PartitionViewerBlock,
  parse: ParseViewerBlock,
  edit: EditViewerBlock,
  "extraction-viewer": ExtractionViewerBlock,
  extract: ExtractViewerBlock,
  "image-sources": ImageSourcesBlock,
  "text-sources": TextSourcesBlock,
  "csv-sources": CsvSourcesBlock,
  "xlsx-sources": XlsxSourcesBlock,
  "docx-sources": DocxSourcesBlock,
  dropzone: DropzoneBlock,
  "dropzone-file-uploader": DefaultFileUploaderExample,
  "dropzone-file-viewer": DropzoneFileViewerExample,
  "dropzone-non-button-trigger": NonButtonTrigger,
  "dropzone-native-button-queue": NativeButtonQueue,
  "dropzone-controlled-queue": ControlledQueue,
  "dropzone-validation-only": ValidationOnly,
  "dropzone-custom-thumbnail-grid": CustomThumbnailGrid,
  "dropzone-media-transcript-queue": MediaTranscriptQueue,
  "dropzone-avatar-image-slot": AvatarImageSlot,
  "dropzone-spreadsheet-import": SpreadsheetImportCard,
  "dropzone-evidence-timeline": EvidenceTimeline,
  "dropzone-comparison-pair": ComparisonPairUpload,
  "dropzone-intake-router": IntakeRouter,
  "dropzone-required-packet": RequiredPacketSlots,
  "dropzone-pinboard": PinboardDropSurface,
  "dropzone-disabled": DisabledDropzone,
  "file-system": FileSystemBlock,
  fslight: FsLightBlock,
  "primitive-cards": PrimitiveCardsBlock,
  "legend-variants": () => <LegendVariantsBlock columns={3} />,
  "pdf-thumbnails": PdfThumbnailsBlock,
} satisfies Record<ViewerBlockId, React.ComponentType>

const viewerBlocks: ViewerBlock[] = VIEWER_BLOCKS.map((block) => ({
  ...block,
  component: blockComponents[block.id],
}))

// Some tabs lead with two viewers sharing a single 50/50 row instead of
// stacking full-width; the rest stay full-width below it. Keyed by tab.
const PAIRED_BLOCK_IDS: Partial<
  Record<ViewerBlockCategoryTabId, ViewerBlockId[]>
> = {
  featured: ["split", "pdf-thumbnails"],
  primitives: ["split", "partition"],
}

export function ViewerBlocks() {
  const [activeCategory, setActiveCategory] = useBlockCategoryState()

  const visibleBlocks = viewerBlocks.filter((block) =>
    activeCategory === "featured"
      ? block.featured
      : block.categories.includes(activeCategory)
  )

  const renderBlock = (block: ViewerBlock) => (
    <ViewerBlockPreview key={block.id} block={block} />
  )

  // Lead with this tab's paired viewers in a shared 50/50 row (in the configured
  // order), then stack the remaining blocks full-width beneath it.
  const pairedIds = PAIRED_BLOCK_IDS[activeCategory] ?? []
  const pairedBlocks = pairedIds
    .map((id) => visibleBlocks.find((block) => block.id === id))
    .filter((block): block is ViewerBlock => Boolean(block))
  const showPaired = pairedBlocks.length === 2
  const stackedBlocks = showPaired
    ? visibleBlocks.filter((block) => !pairedIds.includes(block.id))
    : visibleBlocks

  return (
    <section className="space-y-8">
      <BlockCategoryNavigation
        active={activeCategory}
        onSelect={setActiveCategory}
      />
      {visibleBlocks.length ? (
        <div className="space-y-12">
          {showPaired ? (
            <div className="grid grid-cols-1 gap-12 lg:grid-cols-2">
              {pairedBlocks.map(renderBlock)}
            </div>
          ) : null}
          {stackedBlocks.map(renderBlock)}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed py-24 text-center text-sm text-muted-foreground">
          No blocks in this category yet.
        </div>
      )}
    </section>
  )
}

function BlockCategoryNavigation({
  active,
  onSelect,
}: {
  active: ViewerBlockCategoryTabId
  onSelect: (category: ViewerBlockCategoryTabId) => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-3 pb-3">
      <NavigationMenu
        aria-label="Block categories"
        className="max-w-none flex-none justify-start"
        viewport={false}
      >
        <NavigationMenuList
          className="flex flex-wrap items-center justify-start gap-0"
          style={{ columnGap: "2rem", rowGap: "0.25rem" }}
        >
          {VIEWER_BLOCK_CATEGORIES.map((category) => {
            const isActive = active === category.id
            return (
              <NavigationMenuItem key={category.id}>
                <NavigationMenuLink
                  active={isActive}
                  asChild
                  className={cn(
                    "flex-row gap-0 rounded-none bg-transparent p-0 text-base font-medium tracking-tight transition-colors",
                    "hover:bg-transparent focus:bg-transparent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0 focus-visible:outline-none",
                    "data-[active=true]:bg-transparent data-[active=true]:hover:bg-transparent data-[active=true]:focus:bg-transparent",
                    isActive
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Link
                    href={getBlockCategoryHref(category.id)}
                    onClick={() => onSelect(category.id)}
                    aria-current={isActive ? "page" : undefined}
                  >
                    {category.label}
                  </Link>
                </NavigationMenuLink>
              </NavigationMenuItem>
            )
          })}
        </NavigationMenuList>
      </NavigationMenu>
      <Button
        variant="secondary"
        size="sm"
        className="ml-auto"
        render={<Link href="/docs/components" />}
      >
        Browse components
      </Button>
    </div>
  )
}

function useBlockCategoryState() {
  const [activeCategory, setActiveCategory] =
    React.useState<ViewerBlockCategoryTabId>("featured")

  React.useEffect(() => {
    function syncActiveCategory() {
      setActiveCategory(getBlockCategoryFromLocation())
    }

    syncActiveCategory()
    window.addEventListener("hashchange", syncActiveCategory)
    window.addEventListener("popstate", syncActiveCategory)
    return () => {
      window.removeEventListener("hashchange", syncActiveCategory)
      window.removeEventListener("popstate", syncActiveCategory)
    }
  }, [])

  return [activeCategory, setActiveCategory] as const
}

function getBlockCategoryFromLocation(): ViewerBlockCategoryTabId {
  const hash = window.location.hash.slice(1)
  if (!hash.startsWith(BLOCK_CATEGORY_HASH_PREFIX)) return "featured"
  return getViewerBlockCategoryTabId(
    hash.slice(BLOCK_CATEGORY_HASH_PREFIX.length)
  )
}

function getViewerBlockCategoryTabId(value: string): ViewerBlockCategoryTabId {
  const category = VIEWER_BLOCK_CATEGORIES.find(({ id }) => id === value)
  return category?.id ?? "featured"
}

function getBlockCategoryHref(category: ViewerBlockCategoryTabId) {
  return `/blocks#${BLOCK_CATEGORY_HASH_PREFIX}${category}`
}

function ViewerBlockPreview({ block }: { block: ViewerBlock }) {
  const [previewKey] = React.useState(0)
  const [view, setView] = React.useState<BlockView>("preview")
  const [codeRequestKey, setCodeRequestKey] = React.useState(0)
  const [codeScrollResetKey, setCodeScrollResetKey] = React.useState(0)
  const [isCommandCopied, setIsCommandCopied] = React.useState(false)
  const [codeSamplesState, setCodeSamplesState] =
    React.useState<BlockCodeSamplesState>({
      status: "idle",
      codeSamples: [],
    })
  const codeSamples = codeSamplesState.codeSamples
  const [activeFile, setActiveFile] = React.useState<string | null>(
    codeSamples[0]?.targetPath ?? null
  )
  const [articleRef, shouldMountPreview] = useLazyBlockPreview()
  const isMounted = useMounted()
  const Preview = block.component
  const isDesktopViewport = useMediaQuery("(min-width: 768px)")
  const previewHeightClassName =
    block.previewHeightClassName ?? BLOCK_VIEWPORT_HEIGHT_CLASS
  const isPreviewFrameless = block.categories.some(
    (category) => category === "dropzone" || category === "file-system"
  )

  function setBlockView(nextView: BlockView) {
    if (nextView === "code") {
      if (codeSamplesState.status === "idle") {
        setCodeRequestKey((key) => key + 1)
      }
      setCodeScrollResetKey((key) => key + 1)
    }
    setView(nextView)
  }

  React.useEffect(() => {
    if (!isCommandCopied) return
    const timer = window.setTimeout(() => setIsCommandCopied(false), 2000)
    return () => window.clearTimeout(timer)
  }, [isCommandCopied])

  React.useEffect(() => {
    if (codeRequestKey === 0 || codeSamplesState.status !== "idle") return

    const controller = new AbortController()

    async function loadCodeSamples() {
      setCodeSamplesState({ status: "loading", codeSamples: [] })

      try {
        const response = await fetch(
          `/api/block-code-samples/${encodeURIComponent(block.id)}`,
          { signal: controller.signal }
        )
        if (!response.ok) {
          throw new Error(`Request failed with ${response.status}`)
        }
        const payload = (await response.json()) as {
          codeSamples?: BlockCodeSample[]
        }
        setCodeSamplesState({
          status: "ready",
          codeSamples: payload.codeSamples ?? [],
        })
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return
        setCodeSamplesState({
          status: "error",
          codeSamples: [],
          error: "Could not load source files.",
        })
      }
    }

    void loadCodeSamples()
    return () => controller.abort()
  }, [block.id, codeRequestKey])

  React.useEffect(() => {
    if (!codeSamples.length) {
      setActiveFile(null)
      return
    }
    if (
      !activeFile ||
      !codeSamples.some((sample) => sample.targetPath === activeFile)
    ) {
      setActiveFile(codeSamples[0]?.targetPath ?? null)
    }
  }, [activeFile, codeSamples])

  async function copyInstallCommand() {
    const copied = await copyToClipboardWithMeta(block.command)
    if (copied) setIsCommandCopied(true)
  }

  function retryCodeSamples() {
    setCodeSamplesState({ status: "idle", codeSamples: [] })
    setView("code")
    setCodeRequestKey((key) => key + 1)
  }

  return (
    <article ref={articleRef} id={block.id} className="scroll-mt-24 space-y-2">
      <div
        data-view={view}
        className="group/block-preview overflow-hidden rounded-xl"
      >
        <div className="flex min-h-11 flex-wrap items-center gap-2 px-2 pb-2">
          <BlockViewToggle view={view} onViewChange={setBlockView} />
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <a
              href={`#${block.id}`}
              className="min-w-0 truncate text-sm font-medium underline-offset-2 hover:underline"
            >
              {block.title}
            </a>
            {block.badge ? (
              <span className="shrink-0 rounded-full border bg-background px-1.5 text-[0.625rem] leading-4 tracking-wide text-muted-foreground uppercase">
                {block.badge}
              </span>
            ) : null}
          </div>
          <div className="ml-auto flex min-w-0 items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="hidden max-w-[24rem] min-w-0 gap-1 px-2 shadow-none lg:flex"
              aria-label={
                isCommandCopied
                  ? "Copied install command"
                  : "Copy install command"
              }
              onClick={copyInstallCommand}
            >
              <CopyButtonIcon
                copied={isCommandCopied}
                icon={Terminal}
                className="shrink-0"
              />
              <span className="truncate font-mono text-xs">
                {block.command}
              </span>
            </Button>
          </div>
        </div>

        <div className={view === "preview" ? "block" : "hidden"}>
          {isPreviewFrameless ? (
            <div
              className={cn(
                "hidden min-w-0 overflow-hidden bg-background md:block",
                previewHeightClassName
              )}
            >
              <BlockPreviewSurface
                Preview={Preview}
                isMounted={isMounted}
                previewKey={previewKey}
                shouldRenderPreview={isDesktopViewport && shouldMountPreview}
              />
            </div>
          ) : (
            <div
              className={cn(
                "relative box-content hidden overflow-hidden rounded-xl border bg-muted/30 md:block",
                previewHeightClassName
              )}
            >
              <div className="absolute inset-0 right-4 bg-[radial-gradient(var(--border)_1px,transparent_1px)] bg-[size:20px_20px]" />
              <div className="relative z-10 h-full min-w-0 overflow-hidden rounded-xl bg-background">
                <BlockPreviewSurface
                  Preview={Preview}
                  isMounted={isMounted}
                  previewKey={previewKey}
                  shouldRenderPreview={isDesktopViewport && shouldMountPreview}
                />
              </div>
            </div>
          )}
          {isPreviewFrameless ? (
            <div className="overflow-hidden bg-background md:hidden">
              <BlockPreviewSurface
                Preview={Preview}
                isMounted={isMounted}
                previewKey={previewKey}
                shouldRenderPreview={!isDesktopViewport && shouldMountPreview}
              />
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border bg-background md:hidden">
              <BlockPreviewSurface
                Preview={Preview}
                isMounted={isMounted}
                previewKey={previewKey}
                shouldRenderPreview={!isDesktopViewport && shouldMountPreview}
              />
            </div>
          )}
        </div>

        {view === "code" ? (
          <div className={view === "code" ? "block" : "hidden"}>
            <BlockCodePanel
              codeSamplesState={codeSamplesState}
              activeFile={activeFile}
              onActiveFileChange={setActiveFile}
              onRetry={retryCodeSamples}
              scrollResetKey={codeScrollResetKey}
            />
          </div>
        ) : null}
      </div>
    </article>
  )
}

function useLazyBlockPreview() {
  const [node, setNode] = React.useState<HTMLElement | null>(null)
  const [shouldMountPreview, setShouldMountPreview] = React.useState(false)

  React.useEffect(() => {
    if (shouldMountPreview) return
    if (!node) return
    if (!("IntersectionObserver" in window)) {
      setShouldMountPreview(true)
      return
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return
        setShouldMountPreview(true)
        observer.disconnect()
      },
      { rootMargin: BLOCK_PREVIEW_LAZY_ROOT_MARGIN }
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [node, shouldMountPreview])

  return [setNode, shouldMountPreview] as const
}

function BlockPreviewPlaceholder() {
  return <div className="h-full min-h-[560px] bg-muted/20" />
}

function BlockViewToggle({
  view,
  onViewChange,
}: {
  view: BlockView
  onViewChange: (view: BlockView) => void
}) {
  return (
    <div
      role="tablist"
      aria-label="Block view"
      className="flex w-fit items-center gap-0.5 rounded-lg bg-muted p-0.5 text-muted-foreground/72"
    >
      {(["preview", "code"] as const).map((item) => {
        const isActive = view === item
        return (
          <button
            key={item}
            type="button"
            role="tab"
            aria-selected={isActive}
            className={cn(
              "flex h-8 items-center justify-center rounded-md px-2.5 text-sm font-medium whitespace-nowrap transition-colors outline-none hover:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring",
              isActive &&
                "bg-background text-foreground shadow-sm hover:text-foreground dark:bg-input"
            )}
            onClick={() => onViewChange(item)}
          >
            {item === "preview" ? "Preview" : "Code"}
          </button>
        )
      })}
    </div>
  )
}

const BlockPreviewSurface = React.memo(function BlockPreviewSurface({
  Preview,
  isMounted,
  previewKey,
  shouldRenderPreview,
}: {
  Preview: React.ComponentType
  isMounted: boolean
  previewKey: number
  shouldRenderPreview: boolean
}) {
  if (!isMounted || !shouldRenderPreview) {
    return <BlockPreviewPlaceholder />
  }
  return <Preview key={previewKey} />
})

function BlockCodePanel({
  codeSamplesState,
  activeFile,
  onActiveFileChange,
  onRetry,
  scrollResetKey,
}: {
  codeSamplesState: BlockCodeSamplesState
  activeFile: string | null
  onActiveFileChange: (file: string) => void
  onRetry: () => void
  scrollResetKey: React.Key
}) {
  const codeSamples = codeSamplesState.codeSamples
  const activeCodeSample =
    codeSamples.find((sample) => sample.targetPath === activeFile) ??
    codeSamples[0]

  if (
    codeSamplesState.status === "idle" ||
    codeSamplesState.status === "loading"
  ) {
    return (
      <div
        className={cn(
          "grid place-items-center rounded-xl border bg-code text-sm text-code-foreground",
          BLOCK_VIEWPORT_HEIGHT_CLASS
        )}
      >
        <div className="flex items-center gap-2 text-code-foreground/78">
          <Loader2 className="size-4 animate-spin" />
          Loading source files...
        </div>
      </div>
    )
  }

  if (codeSamplesState.status === "error") {
    return (
      <div
        className={cn(
          "grid place-items-center rounded-xl border bg-code text-sm text-code-foreground",
          BLOCK_VIEWPORT_HEIGHT_CLASS
        )}
      >
        <div className="flex flex-col items-center gap-3 text-code-foreground/78">
          <span>{codeSamplesState.error}</span>
          <Button type="button" variant="secondary" size="sm" onClick={onRetry}>
            Retry
          </Button>
        </div>
      </div>
    )
  }

  if (!activeCodeSample) {
    return (
      <div
        className={cn(
          "grid place-items-center rounded-xl border bg-code text-sm text-code-foreground",
          BLOCK_VIEWPORT_HEIGHT_CLASS
        )}
      >
        No source sample available.
      </div>
    )
  }

  return (
    <div
      className={cn(
        "flex overflow-hidden rounded-xl border bg-code text-code-foreground",
        BLOCK_VIEWPORT_HEIGHT_CLASS
      )}
    >
      <div className="hidden w-72 shrink-0 flex-col border-r bg-code md:flex">
        <div className="flex h-12 items-center border-b px-4 text-sm font-medium">
          Files
        </div>
        <BlockFileList
          codeSamples={codeSamples}
          activeFile={activeCodeSample.targetPath}
          onActiveFileChange={onActiveFileChange}
        />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-12 items-center gap-2 border-b px-4 text-sm">
          <Code className="size-4 opacity-70" />
          <span className="truncate">{activeCodeSample.targetPath}</span>
          <CodeHeaderCopyButton
            value={activeCodeSample.content}
            className="ml-auto"
          />
        </div>
        <HighlightedCodeBlock
          code={activeCodeSample.content}
          fileName={activeCodeSample.targetPath}
          language={activeCodeSample.language}
          lazy={false}
          renderFallbackCode
          scrollResetKey={scrollResetKey}
          showCopy={false}
          className="min-h-0 flex-1 rounded-none border-0"
          maxHeightClassName="h-full max-h-none"
        />
      </div>
    </div>
  )
}

function BlockFileList({
  codeSamples,
  activeFile,
  onActiveFileChange,
}: {
  codeSamples: BlockCodeSample[]
  activeFile: string
  onActiveFileChange: (file: string) => void
}) {
  return (
    <nav className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-auto p-2">
      {codeSamples.map((sample) => {
        const isActive = sample.targetPath === activeFile
        const name = sample.targetPath.split("/").pop()
        return (
          <button
            key={sample.targetPath}
            type="button"
            title={sample.targetPath}
            onClick={() => onActiveFileChange(sample.targetPath)}
            className={cn(
              "flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors",
              isActive
                ? "bg-primary text-primary-foreground"
                : "text-code-foreground/78 hover:bg-foreground/5"
            )}
          >
            <FileCode className="size-4 shrink-0 opacity-70" />
            <span className="truncate">{name}</span>
          </button>
        )
      })}
    </nav>
  )
}
