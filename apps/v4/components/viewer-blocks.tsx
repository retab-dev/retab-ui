"use client"

import * as React from "react"
import Link from "next/link"
import {
  Code,
  FileCode,
  Laptop,
  Maximize2,
  RotateCw,
  Smartphone,
  Tablet,
  Terminal,
} from "lucide-react"
import type { PanelImperativeHandle } from "react-resizable-panels"

import {
  VIEWER_BLOCK_CATEGORIES,
  VIEWER_BLOCKS,
  type ViewerBlockCategoryTabId,
  type ViewerBlockId,
  type ViewerBlockMetadata,
} from "@/lib/viewer-blocks"
import { cn } from "@/lib/utils"
import { useMediaQuery } from "@/hooks/use-media-query"
import { useMounted } from "@/hooks/use-mounted"
import { Button } from "@/components/ui/button"
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"
import {
  CodeHeaderCopyButton,
  CopyButtonIcon,
  copyToClipboardWithMeta,
} from "@/components/copy-button"
import { HighlightedCodeBlock } from "@/components/highlighted-code-block"
import { ClassificationViewerBlock } from "@/registry/new-york-v4/blocks/classification-viewer-block"
import { ParseViewerBlock } from "@/registry/new-york-v4/blocks/parse-viewer-block"
import { PartitionViewerBlock } from "@/registry/new-york-v4/blocks/partition-viewer-block"
import { PdfThumbnailsBlock } from "@/registry/new-york-v4/blocks/pdf-thumbnails-block"
import { SplitViewerBlock } from "@/registry/new-york-v4/blocks/split-viewer-block"

type BlockCodeSample = {
  sourcePath: string
  targetPath: string
  language: string
  content: string
  lineCount: number
}

type ViewerBlock = ViewerBlockMetadata & { component: React.ComponentType }

type BlockViewportSize = "desktop" | "tablet" | "mobile"
type BlockView = "preview" | "code"

const blockViewportSizes: Array<{
  id: BlockViewportSize
  label: string
  panelSize: number
  icon: typeof Laptop
}> = [
  { id: "desktop", label: "Desktop", panelSize: 100, icon: Laptop },
  { id: "tablet", label: "Tablet", panelSize: 62, icon: Tablet },
  { id: "mobile", label: "Mobile", panelSize: 34, icon: Smartphone },
]

const BLOCK_VIEWPORT_HEIGHT_CLASS = "h-[680px]"
const BLOCK_PREVIEW_LAZY_ROOT_MARGIN = "900px 0px"

const blockComponents = {
  split: SplitViewerBlock,
  partition: PartitionViewerBlock,
  classification: ClassificationViewerBlock,
  parse: ParseViewerBlock,
  "pdf-thumbnails": PdfThumbnailsBlock,
} satisfies Record<ViewerBlockId, React.ComponentType>

const viewerBlocks: ViewerBlock[] = VIEWER_BLOCKS.map((block) => ({
  ...block,
  component: blockComponents[block.id],
}))

export function ViewerBlocks({
  codeSamples,
}: {
  codeSamples: Record<string, BlockCodeSample[]>
}) {
  const [activeCategory, setActiveCategory] =
    React.useState<ViewerBlockCategoryTabId>("featured")

  const visibleBlocks = viewerBlocks.filter((block) =>
    activeCategory === "featured"
      ? block.featured
      : block.categories.includes(activeCategory)
  )

  return (
    <section className="space-y-8">
      <BlockCategoryTabs active={activeCategory} onChange={setActiveCategory} />
      {visibleBlocks.length ? (
        <div className="space-y-12">
          {visibleBlocks.map((block) => (
            <ViewerBlockPreview
              key={block.id}
              block={block}
              codeSamples={codeSamples[block.id] ?? []}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed py-24 text-center text-sm text-muted-foreground">
          No blocks in this category yet.
        </div>
      )}
    </section>
  )
}

function BlockCategoryTabs({
  active,
  onChange,
}: {
  active: ViewerBlockCategoryTabId
  onChange: (category: ViewerBlockCategoryTabId) => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-b pb-3">
      <div
        role="tablist"
        aria-label="Block categories"
        className="flex flex-wrap items-center"
        style={{ columnGap: "2rem", rowGap: "0.25rem" }}
      >
        {VIEWER_BLOCK_CATEGORIES.map((category) => {
          const isActive = active === category.id
          return (
            <button
              key={category.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onChange(category.id)}
              className={cn(
                "text-lg font-medium tracking-tight transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
                isActive
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {category.label}
            </button>
          )
        })}
      </div>
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

function ViewerBlockPreview({
  block,
  codeSamples,
}: {
  block: ViewerBlock
  codeSamples: BlockCodeSample[]
}) {
  const [previewKey, setPreviewKey] = React.useState(0)
  const [view, setView] = React.useState<BlockView>("preview")
  const [hasOpenedCode, setHasOpenedCode] = React.useState(false)
  const [codeScrollResetKey, setCodeScrollResetKey] = React.useState(0)
  const [activeViewport, setActiveViewport] =
    React.useState<BlockViewportSize>("desktop")
  const [isCommandCopied, setIsCommandCopied] = React.useState(false)
  const [activeFile, setActiveFile] = React.useState<string | null>(
    codeSamples[0]?.targetPath ?? null
  )
  const [articleRef, shouldMountPreview] = useLazyBlockPreview()
  const isMounted = useMounted()
  const previewPanelRef = React.useRef<PanelImperativeHandle>(null)
  const Preview = block.component
  const isDesktopViewport = useMediaQuery("(min-width: 768px)")
  const previewHeightClassName =
    block.previewHeightClassName ?? BLOCK_VIEWPORT_HEIGHT_CLASS

  function setBlockView(nextView: BlockView) {
    if (nextView === "code") {
      setHasOpenedCode(true)
      setCodeScrollResetKey((key) => key + 1)
    }
    setView(nextView)
  }

  function resizeViewport(viewport: (typeof blockViewportSizes)[number]) {
    setView("preview")
    setActiveViewport(viewport.id)
    previewPanelRef.current?.resize(`${viewport.panelSize}%`)
  }

  React.useEffect(() => {
    if (!isCommandCopied) return
    const timer = window.setTimeout(() => setIsCommandCopied(false), 2000)
    return () => window.clearTimeout(timer)
  }, [isCommandCopied])

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

  return (
    <article ref={articleRef} id={block.id} className="scroll-mt-24 space-y-2">
      <div data-view={view} className="group/block-preview overflow-hidden rounded-xl">
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
            <div className="hidden items-center gap-1 rounded-md border bg-background p-0.5 sm:flex">
              {blockViewportSizes.map((viewport) => {
                const Icon = viewport.icon
                return (
                  <Button
                    key={viewport.id}
                    type="button"
                    variant={activeViewport === viewport.id ? "secondary" : "ghost"}
                    size="icon-sm"
                    className="size-7"
                    title={viewport.label}
                    aria-label={`${viewport.label} viewport`}
                    onClick={() => resizeViewport(viewport)}
                  >
                    <Icon className="size-4" />
                  </Button>
                )
              })}
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="size-7"
                title="Open fullscreen preview"
                aria-label={`Open ${block.title} fullscreen preview`}
                render={<Link href={block.viewHref} target="_blank" />}
              >
                <Maximize2 className="size-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="size-7"
                title="Refresh preview"
                aria-label={`Refresh ${block.title} preview`}
                onClick={() => setPreviewKey((value) => value + 1)}
              >
                <RotateCw className="size-4" />
              </Button>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="hidden max-w-[24rem] min-w-0 gap-1 px-2 shadow-none lg:flex"
              aria-label={
                isCommandCopied ? "Copied install command" : "Copy install command"
              }
              onClick={copyInstallCommand}
            >
              <CopyButtonIcon copied={isCommandCopied} icon={Terminal} className="shrink-0" />
              <span className="truncate font-mono text-xs">{block.command}</span>
            </Button>
          </div>
        </div>

        <div className={view === "preview" ? "block" : "hidden"}>
          <div
            className={cn(
              "relative hidden box-content overflow-hidden rounded-xl border bg-muted/30 md:block",
              previewHeightClassName
            )}
          >
            <div className="absolute inset-0 right-4 bg-[radial-gradient(var(--border)_1px,transparent_1px)] bg-[size:20px_20px]" />
            <ResizablePanelGroup orientation="horizontal" className="relative z-10 h-full">
              <ResizablePanel
                ref={previewPanelRef}
                defaultSize="100%"
                minSize="30%"
                className="min-w-0 overflow-hidden rounded-xl bg-background"
              >
                <BlockPreviewSurface
                  Preview={Preview}
                  isMounted={isMounted}
                  previewKey={previewKey}
                  shouldRenderPreview={isDesktopViewport && shouldMountPreview}
                />
              </ResizablePanel>
              <ResizableHandle className="relative w-3 bg-transparent p-0 after:absolute after:top-1/2 after:right-0 after:h-8 after:w-1.5 after:-translate-y-1/2 after:rounded-full after:bg-background after:shadow-sm after:ring-1 after:ring-border after:transition-all after:hover:h-10" />
              <ResizablePanel defaultSize="0%" minSize="0%" />
            </ResizablePanelGroup>
          </div>
          <div className="overflow-hidden rounded-xl border bg-background md:hidden">
            <BlockPreviewSurface
              Preview={Preview}
              isMounted={isMounted}
              previewKey={previewKey}
              shouldRenderPreview={!isDesktopViewport && shouldMountPreview}
            />
          </div>
        </div>

        {hasOpenedCode ? (
          <div className={view === "code" ? "block" : "hidden"}>
            <BlockCodePanel
              codeSamples={codeSamples}
              activeFile={activeFile}
              onActiveFileChange={setActiveFile}
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
  codeSamples,
  activeFile,
  onActiveFileChange,
  scrollResetKey,
}: {
  codeSamples: BlockCodeSample[]
  activeFile: string | null
  onActiveFileChange: (file: string) => void
  scrollResetKey: React.Key
}) {
  const activeCodeSample =
    codeSamples.find((sample) => sample.targetPath === activeFile) ?? codeSamples[0]

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
          <CodeHeaderCopyButton value={activeCodeSample.content} className="ml-auto" />
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
