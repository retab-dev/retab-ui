"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Code, FileCode, Loader2, Terminal } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  VIEWER_BLOCK_TABS,
  VIEWER_BLOCKS,
  type ViewerBlockId,
} from "@/lib/viewer-blocks";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useMounted } from "@/hooks/use-mounted";
import { Button } from "@/components/ui/button";
import {
  CodeHeaderCopyButton,
  CopyButtonIcon,
  copyToClipboardWithMeta,
} from "@/components/copy-button";
import { HighlightedCodeBlock } from "@/components/highlighted-code-block";
import {
  withViewerBlockComponent,
  type ViewerBlockWithComponent,
} from "@/components/viewer-block-component-registry";
import { useKeyedMountEffect } from "@/hooks/use-keyed-mount-effect";
import { joinEffectKey } from "@/lib/effect-key";

type BlockCodeSample = {
  sourcePath: string;
  targetPath: string;
  language: string;
  content: string;
  lineCount: number;
};

type BlockCodeSamplesState =
  | { status: "idle"; codeSamples: BlockCodeSample[]; error?: undefined }
  | { status: "loading"; codeSamples: BlockCodeSample[]; error?: undefined }
  | { status: "ready"; codeSamples: BlockCodeSample[]; error?: undefined }
  | { status: "error"; codeSamples: BlockCodeSample[]; error: string };

type BlockView = "preview" | "code";

const BLOCK_VIEWPORT_HEIGHT_CLASS = "h-[680px]";
const BLOCK_PREVIEW_LAZY_ROOT_MARGIN = "900px 0px";

const viewerBlocks = VIEWER_BLOCKS.map(withViewerBlockComponent);
const viewerBlockTabs = VIEWER_BLOCK_TABS.map(withViewerBlockComponent);

export function ViewerBlocks({ blockId }: { blockId: ViewerBlockId }) {
  const activeBlock = viewerBlocks.find((block) => block.id === blockId);

  if (!activeBlock) {
    return null;
  }

  return <ViewerBlockPreview key={activeBlock.id} block={activeBlock} />;
}

export function ViewerBlockTabs() {
  const pathname = usePathname();
  const activeBlock = viewerBlockTabs.find(
    (block) => pathname === getBlockHref(block.id),
  );

  return (
    <div className="flex flex-wrap items-start gap-x-6 gap-y-3 pb-3">
      <nav
        aria-label="Block categories"
        className="w-full max-w-none min-w-0 flex-1 justify-start"
      >
        <ul className="grid w-full list-none grid-cols-[repeat(auto-fit,minmax(9.5rem,1fr))] items-start gap-x-8 gap-y-2">
          {viewerBlockTabs.map((block) => {
            const isActive = activeBlock?.id === block.id;
            return (
              <li key={block.id}>
                <Link
                  href={getBlockHref(block.id)}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "block rounded-none bg-transparent p-0 text-left text-base font-medium tracking-tight transition-colors",
                    "focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-0 focus-visible:outline-none",
                    isActive
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {block.title}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <Button variant="secondary" size="sm" className="ml-auto" asChild>
        <Link href="/docs/components">Browse components</Link>
      </Button>
    </div>
  );
}

function getBlockHref(blockId: ViewerBlockId) {
  return `/blocks/${blockId}`;
}

function ViewerBlockPreview({ block }: { block: ViewerBlockWithComponent }) {
  const [previewKey] = React.useState(0);
  const [view, setView] = React.useState<BlockView>("preview");
  const [codeRequestKey, setCodeRequestKey] = React.useState(0);
  const [codeScrollResetKey, setCodeScrollResetKey] = React.useState(0);
  const [isCommandCopied, setIsCommandCopied] = React.useState(false);
  const [codeSamplesState, setCodeSamplesState] =
    React.useState<BlockCodeSamplesState>({
      status: "idle",
      codeSamples: [],
    });
  const codeSamples = codeSamplesState.codeSamples;
  const [activeFile, setActiveFile] = React.useState<string | null>(
    codeSamples[0]?.targetPath ?? null,
  );
  const [articleRef, shouldMountPreview] = useLazyBlockPreview();
  const isMounted = useMounted();
  const Preview = block.component;
  const isDesktopViewport = useMediaQuery("(min-width: 768px)");
  const previewHeightClassName =
    block.previewHeightClassName ?? BLOCK_VIEWPORT_HEIGHT_CLASS;
  const isPreviewFrameless = block.categories.some(
    (category) => category === "dropzone" || category === "file-system",
  );

  function setBlockView(nextView: BlockView) {
    if (nextView === "code") {
      if (codeSamplesState.status === "idle") {
        setCodeRequestKey((key) => key + 1);
      }
      setCodeScrollResetKey((key) => key + 1);
    }
    setView(nextView);
  }

  useKeyedMountEffect(joinEffectKey([isCommandCopied]), () => {
    if (!isCommandCopied) return;
    const timer = window.setTimeout(() => setIsCommandCopied(false), 2000);
    return () => window.clearTimeout(timer);
  });

  useKeyedMountEffect(joinEffectKey([block.id, codeRequestKey]), () => {
    if (codeRequestKey === 0) return;

    const controller = new AbortController();

    async function loadCodeSamples() {
      setCodeSamplesState({ status: "loading", codeSamples: [] });

      try {
        const response = await fetch(
          `/api/block-code-samples/${encodeURIComponent(block.id)}`,
          { signal: controller.signal },
        );
        if (!response.ok) {
          throw new Error(`Request failed with ${response.status}`);
        }
        const payload = (await response.json()) as {
          codeSamples?: BlockCodeSample[];
        };
        setCodeSamplesState({
          status: "ready",
          codeSamples: payload.codeSamples ?? [],
        });
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError")
          return;
        setCodeSamplesState({
          status: "error",
          codeSamples: [],
          error: "Could not load source files.",
        });
      }
    }

    void loadCodeSamples();
    return () => controller.abort();
  });

  useKeyedMountEffect(joinEffectKey([activeFile, codeSamples]), () => {
    if (!codeSamples.length) {
      setActiveFile(null);
      return;
    }
    if (
      !activeFile ||
      !codeSamples.some((sample) => sample.targetPath === activeFile)
    ) {
      setActiveFile(codeSamples[0]?.targetPath ?? null);
    }
  });

  async function copyInstallCommand() {
    const copied = await copyToClipboardWithMeta(block.command);
    if (copied) setIsCommandCopied(true);
  }

  function retryCodeSamples() {
    setCodeSamplesState({ status: "idle", codeSamples: [] });
    setView("code");
    setCodeRequestKey((key) => key + 1);
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
              href={getBlockHref(block.id)}
              className="min-w-0 truncate text-sm font-medium underline-offset-2 hover:underline"
            >
              {block.title}
            </a>
            {block.badge ? (
              <span className="bg-background text-muted-foreground shrink-0 rounded-full border px-1.5 text-[0.625rem] leading-4 tracking-wide uppercase">
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
                "bg-background hidden min-w-0 overflow-hidden md:block",
                previewHeightClassName,
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
                "bg-muted/30 relative box-content hidden overflow-hidden rounded-xl border md:block",
                previewHeightClassName,
              )}
            >
              <div className="absolute inset-0 right-4 bg-[radial-gradient(var(--border)_1px,transparent_1px)] bg-[size:20px_20px]" />
              <div className="bg-background relative z-10 h-full min-w-0 overflow-hidden rounded-xl">
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
            <div className="bg-background overflow-hidden md:hidden">
              <BlockPreviewSurface
                Preview={Preview}
                isMounted={isMounted}
                previewKey={previewKey}
                shouldRenderPreview={!isDesktopViewport && shouldMountPreview}
              />
            </div>
          ) : (
            <div className="bg-background overflow-hidden rounded-xl border md:hidden">
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
  );
}

function useLazyBlockPreview() {
  const [node, setNode] = React.useState<HTMLElement | null>(null);
  const [shouldMountPreview, setShouldMountPreview] = React.useState(false);

  useKeyedMountEffect(joinEffectKey([node, shouldMountPreview]), () => {
    if (shouldMountPreview) return;
    if (!node) return;
    if (!("IntersectionObserver" in window)) {
      setShouldMountPreview(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        setShouldMountPreview(true);
        observer.disconnect();
      },
      { rootMargin: BLOCK_PREVIEW_LAZY_ROOT_MARGIN },
    );
    observer.observe(node);
    return () => observer.disconnect();
  });

  return [setNode, shouldMountPreview] as const;
}

function BlockPreviewPlaceholder() {
  return <div className="bg-muted/20 h-full min-h-[560px]" />;
}

function BlockViewToggle({
  view,
  onViewChange,
}: {
  view: BlockView;
  onViewChange: (view: BlockView) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Block view"
      className="bg-muted text-muted-foreground/72 flex w-fit items-center gap-0.5 rounded-lg p-0.5"
    >
      {(["preview", "code"] as const).map((item) => {
        const isActive = view === item;
        return (
          <button
            key={item}
            type="button"
            role="tab"
            aria-selected={isActive}
            className={cn(
              "hover:text-muted-foreground focus-visible:ring-ring flex h-8 items-center justify-center rounded-md px-2.5 text-sm font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-2",
              isActive &&
                "bg-background text-foreground hover:text-foreground dark:bg-input shadow-sm",
            )}
            onClick={() => onViewChange(item)}
          >
            {item === "preview" ? "Preview" : "Code"}
          </button>
        );
      })}
    </div>
  );
}

const BlockPreviewSurface = React.memo(function BlockPreviewSurface({
  Preview,
  isMounted,
  previewKey,
  shouldRenderPreview,
}: {
  Preview: React.ComponentType;
  isMounted: boolean;
  previewKey: number;
  shouldRenderPreview: boolean;
}) {
  if (!isMounted || !shouldRenderPreview) {
    return <BlockPreviewPlaceholder />;
  }
  return <Preview key={previewKey} />;
});

function BlockCodePanel({
  codeSamplesState,
  activeFile,
  onActiveFileChange,
  onRetry,
  scrollResetKey,
}: {
  codeSamplesState: BlockCodeSamplesState;
  activeFile: string | null;
  onActiveFileChange: (file: string) => void;
  onRetry: () => void;
  scrollResetKey: React.Key;
}) {
  const codeSamples = codeSamplesState.codeSamples;
  const activeCodeSample =
    codeSamples.find((sample) => sample.targetPath === activeFile) ??
    codeSamples[0];

  if (
    codeSamplesState.status === "idle" ||
    codeSamplesState.status === "loading"
  ) {
    return (
      <div
        className={cn(
          "bg-code text-code-foreground grid place-items-center rounded-xl border text-sm",
          BLOCK_VIEWPORT_HEIGHT_CLASS,
        )}
      >
        <div className="text-code-foreground/78 flex items-center gap-2">
          <Loader2 className="size-4 animate-spin" />
          Loading source files...
        </div>
      </div>
    );
  }

  if (codeSamplesState.status === "error") {
    return (
      <div
        className={cn(
          "bg-code text-code-foreground grid place-items-center rounded-xl border text-sm",
          BLOCK_VIEWPORT_HEIGHT_CLASS,
        )}
      >
        <div className="text-code-foreground/78 flex flex-col items-center gap-3">
          <span>{codeSamplesState.error}</span>
          <Button type="button" variant="secondary" size="sm" onClick={onRetry}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  if (!activeCodeSample) {
    return (
      <div
        className={cn(
          "bg-code text-code-foreground grid place-items-center rounded-xl border text-sm",
          BLOCK_VIEWPORT_HEIGHT_CLASS,
        )}
      >
        No source sample available.
      </div>
    );
  }

  return (
    <div
      className={cn(
        "bg-code text-code-foreground flex overflow-hidden rounded-xl border",
        BLOCK_VIEWPORT_HEIGHT_CLASS,
      )}
    >
      <div className="bg-code hidden w-72 shrink-0 flex-col border-r md:flex">
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
  );
}

function BlockFileList({
  codeSamples,
  activeFile,
  onActiveFileChange,
}: {
  codeSamples: BlockCodeSample[];
  activeFile: string;
  onActiveFileChange: (file: string) => void;
}) {
  return (
    <nav className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-auto p-2">
      {codeSamples.map((sample) => {
        const isActive = sample.targetPath === activeFile;
        const name = sample.targetPath.split("/").pop();
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
                : "text-code-foreground/78 hover:bg-foreground/5",
            )}
          >
            <FileCode className="size-4 shrink-0 opacity-70" />
            <span className="truncate">{name}</span>
          </button>
        );
      })}
    </nav>
  );
}
