"use client";

import * as React from "react";
import { type ReactNode } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import { Check, ChevronLeft, ChevronRight, Copy, ScanText } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import {
  type ParseResponse,
  type ParseViewMode,
} from "@/components/viewers/lib/parse-types";

/** Handlers the source-document surface receives so the markdown stays in sync. */
export interface ParseDocumentHandlers {
  onCurrentPageChange: (page: number) => void;
  onScrollProgressChange?: (progress: number) => void;
}

export interface ParseViewerProps {
  result: ParseResponse | null;
  isProcessing?: boolean;
  /**
   * Render the source document beside the extracted markdown. Omit to show the
   * markdown full-width. The document should tag its pages with
   * `data-page-number` so the two panes can scroll to each other.
   */
  renderDocument?: (handlers: ParseDocumentHandlers) => ReactNode;
  /** Fired with the 1-based page nearest the top of the markdown viewport. */
  onVisiblePageChange?: (page: number) => void;
}

export function ParseViewer({
  result,
  isProcessing = false,
  renderDocument,
  onVisiblePageChange,
}: ParseViewerProps) {
  const pages = result?.output?.pages ?? [];
  const hasOutput = result !== null && pages.length > 0;

  const [mode, setMode] = React.useState<ParseViewMode>("rendered");
  const [currentPage, setCurrentPage] = React.useState(1); // 1-based, tracks scroll

  // The markdown is a single scrolling document (like the image viewer); these
  // refs let the document pane and the page controls scroll it to a given page.
  const markdownViewportRef = React.useRef<HTMLDivElement | null>(null);
  const docRef = React.useRef<HTMLDivElement | null>(null);

  const scrollPaneToPage = (
    ref: React.RefObject<HTMLDivElement | null>,
    page: number,
  ) => {
    ref.current
      ?.querySelector<HTMLElement>(`[data-page-number="${page}"]`)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // Report the markdown page nearest the top of its viewport as it scrolls,
  // rAF-coalesced so the layout reads run at most once per frame.
  const scrollFrame = React.useRef(0);
  const lastReported = React.useRef(1);
  const measureScroll = React.useCallback(() => {
    scrollFrame.current = 0;
    const viewport = markdownViewportRef.current;
    if (!viewport) return;
    const rect = viewport.getBoundingClientRect();
    const marker = rect.top + rect.height * 0.2;
    const pageEls = viewport.querySelectorAll<HTMLElement>("[data-page-number]");
    let current = 1;
    for (const el of pageEls) {
      if (el.getBoundingClientRect().top <= marker) {
        current = Number(el.dataset.pageNumber);
      } else {
        break;
      }
    }
    if (current && current !== lastReported.current) {
      lastReported.current = current;
      setCurrentPage(current);
      onVisiblePageChange?.(current);
    }
  }, [onVisiblePageChange]);
  const handleMarkdownScroll = React.useCallback(() => {
    if (scrollFrame.current) return;
    scrollFrame.current = requestAnimationFrame(measureScroll);
  }, [measureScroll]);
  React.useEffect(
    () => () => {
      if (scrollFrame.current) cancelAnimationFrame(scrollFrame.current);
    },
    [],
  );

  // The document reports its visible page; scroll the markdown to match. The
  // ref work runs in an effect (not during render) so we never read refs inline.
  const [docPage, setDocPage] = React.useState(0);
  React.useEffect(() => {
    if (docPage > 0) scrollPaneToPage(markdownViewportRef, docPage);
  }, [docPage]);

  // Page controls → scroll the markdown (and the document, when paired).
  const goToPage = (page: number) => {
    const clamped = Math.min(Math.max(1, page), pages.length);
    scrollPaneToPage(markdownViewportRef, clamped);
    if (docRef.current) scrollPaneToPage(docRef, clamped);
  };

  if (!hasOutput) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 bg-muted/30 px-8 text-muted-foreground">
        {isProcessing ? (
          <>
            <Spinner className="size-8 text-primary" />
            <p className="text-sm">Parsing document…</p>
          </>
        ) : (
          <>
            <ScanText className="size-12 opacity-60" />
            <div className="space-y-1 text-center">
              <p className="text-sm font-medium text-foreground">No parse output yet</p>
              <p className="max-w-xs text-xs">
                Run a parse to see the extracted text and rendered markdown here.
              </p>
            </div>
          </>
        )}
      </div>
    );
  }

  const output = (
    <div className="flex h-full min-h-0 min-w-0 flex-col bg-muted/20">
      <div className="flex h-10 shrink-0 items-center gap-2 border-b bg-card px-3">
        <span className="hidden text-xs font-medium text-muted-foreground sm:inline">
          {renderDocument ? "Extracted" : "Parsed output"}
        </span>
        {pages.length > 1 ? (
          <div className="ml-auto flex items-center gap-0.5">
            <Button
              variant="ghost"
              size="icon-sm"
              className="size-7"
              aria-label="Previous page"
              disabled={currentPage <= 1}
              onClick={() => goToPage(currentPage - 1)}
            >
              <ChevronLeft />
            </Button>
            <span className="px-1 text-xs tabular-nums text-muted-foreground">
              {currentPage} / {pages.length}
            </span>
            <Button
              variant="ghost"
              size="icon-sm"
              className="size-7"
              aria-label="Next page"
              disabled={currentPage >= pages.length}
              onClick={() => goToPage(currentPage + 1)}
            >
              <ChevronRight />
            </Button>
          </div>
        ) : null}
        <div className={cn("flex items-center gap-2.5", pages.length > 1 ? "" : "ml-auto")}>
          <ModeToggle mode={mode} onChange={setMode} />
          <CopyButton text={pages.join("\n\n")} />
        </div>
      </div>

      <ScrollArea
        viewportRef={markdownViewportRef}
        viewportProps={{ onScroll: handleMarkdownScroll }}
        className="min-h-0 flex-1"
      >
        <div className="flex flex-col items-center gap-4 p-4">
          {pages.map((markdown, i) => (
            <ParsePage key={`${mode}-${i}`} index={i} markdown={markdown} mode={mode} />
          ))}
        </div>
      </ScrollArea>
    </div>
  );

  if (!renderDocument) {
    return <div className="flex min-h-0 flex-1 flex-col">{output}</div>;
  }

  return (
    <ResizablePanelGroup direction="horizontal" className="min-h-0 flex-1">
      <ResizablePanel defaultSize={52} minSize={28}>
        <div ref={docRef} className="h-full min-w-0">
          {renderDocument({ onCurrentPageChange: setDocPage })}
        </div>
      </ResizablePanel>
      <ResizableHandle withHandle />
      <ResizablePanel defaultSize={48} minSize={28}>
        {output}
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}

/**
 * One markdown page in the scrolling document — isomorphic to the image viewer's
 * `ImageFrame`. The page renders its markdown only when it nears the viewport
 * (gated by an IntersectionObserver), and its measured height is reserved while
 * off-screen so scroll height and scroll position stay stable. A generous
 * pre-render margin keeps scrolling ahead of the render.
 */
const ParsePage = React.memo(function ParsePage({
  index,
  markdown,
  mode,
}: {
  index: number;
  markdown: string;
  mode: ParseViewMode;
}) {
  const [inView, setInView] = React.useState(false);
  const [height, setHeight] = React.useState<number | null>(null);

  const wrapperRef = React.useCallback((el: HTMLDivElement | null) => {
    if (!el) return;
    // Resolve the scroll container from the DOM: ref callbacks fire children
    // first, so a parent ref isn't populated on first mount; closest() is live.
    const root = el.closest<HTMLElement>('[data-slot="scroll-area-viewport"]');
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) setInView(entry.isIntersecting);
      },
      { root, rootMargin: "200% 0px" },
    );
    io.observe(el);
    // Measure the page's natural height while it's rendered; the value is reused
    // as the reserved height once it scrolls back out.
    const ro = new ResizeObserver(() => {
      if (el.offsetHeight > 0) setHeight(el.offsetHeight);
    });
    ro.observe(el);
    return () => {
      io.disconnect();
      ro.disconnect();
    };
  }, []);

  const reserved = height ?? estimateHeight(markdown);

  return (
    <div
      ref={wrapperRef}
      data-slot="parse-page"
      data-page-number={index + 1}
      className="relative w-full max-w-3xl bg-card shadow-sm ring-1 ring-border"
      // Padding is set inline (not via a Tailwind class) so it always applies,
      // even if the utility wasn't emitted into the stylesheet. Reserve the
      // page's footprint only while its content is unmounted, so the scrollbar
      // is right and re-entry doesn't jump.
      style={{
        paddingInline: "2.25rem",
        paddingBlock: "1.75rem",
        ...(inView ? null : { height: reserved }),
      }}
    >
      {inView ? (
        mode === "rendered" ? (
          <div className="text-sm leading-relaxed">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeRaw]}
              components={markdownComponents}
            >
              {markdown}
            </ReactMarkdown>
          </div>
        ) : (
          <pre className="font-mono text-xs leading-relaxed whitespace-pre-wrap text-foreground/90">
            {markdown}
          </pre>
        )
      ) : (
        <div className="absolute inset-0 flex items-center justify-center">
          <Spinner className="size-4 text-muted-foreground" />
        </div>
      )}
    </div>
  );
});

// Rough height before a page has rendered, so the initial scroll height is
// close. Refined to the exact measured height the first time the page is shown.
function estimateHeight(text: string): number {
  const lines = text.split("\n").length;
  return Math.min(1800, Math.max(180, lines * 26 + 80));
}

function ModeToggle({
  mode,
  onChange,
}: {
  mode: ParseViewMode;
  onChange: (mode: ParseViewMode) => void;
}) {
  return (
    <Tabs value={mode} onValueChange={(value) => onChange(value as ParseViewMode)}>
      <TabsList variant="underline" className="py-0">
        <TabsTrigger value="rendered" className="h-8 text-xs">
          Rendered
        </TabsTrigger>
        <TabsTrigger value="text" className="h-8 text-xs">
          Text
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = React.useState(false);
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      className="size-7"
      aria-label="Copy markdown"
      title="Copy all markdown"
      onClick={() => {
        navigator.clipboard?.writeText(text).then(
          () => {
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1200);
          },
          () => {},
        );
      }}
    >
      {copied ? <Check className="text-emerald-600" /> : <Copy />}
    </Button>
  );
}

// Self-contained markdown styling so the viewer carries no `prose` dependency.
const markdownComponents: Components = {
  h1: (props) => <h1 className="mt-4 mb-2 text-lg font-semibold first:mt-0" {...props} />,
  h2: (props) => <h2 className="mt-4 mb-2 text-base font-semibold first:mt-0" {...props} />,
  h3: (props) => <h3 className="mt-3 mb-1.5 text-sm font-semibold first:mt-0" {...props} />,
  h4: (props) => <h4 className="mt-3 mb-1.5 text-sm font-medium first:mt-0" {...props} />,
  p: (props) => <p className="my-2 leading-relaxed" {...props} />,
  ul: (props) => <ul className="my-2 ml-5 list-disc space-y-1" {...props} />,
  ol: (props) => <ol className="my-2 ml-5 list-decimal space-y-1" {...props} />,
  li: (props) => <li className="leading-relaxed" {...props} />,
  a: (props) => (
    <a className="font-medium text-primary underline underline-offset-2" {...props} />
  ),
  strong: (props) => <strong className="font-semibold" {...props} />,
  hr: (props) => <hr className="my-4 border-border" {...props} />,
  blockquote: (props) => (
    <blockquote
      className="my-3 border-l-2 border-border pl-3 text-muted-foreground italic"
      {...props}
    />
  ),
  code: (props) => (
    <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]" {...props} />
  ),
  pre: (props) => (
    <pre
      className="my-3 overflow-x-auto rounded-lg border bg-muted/50 p-3 font-mono text-xs"
      {...props}
    />
  ),
  table: (props) => (
    <div className="my-3 overflow-x-auto rounded-lg border">
      <table className="w-full border-collapse text-xs" {...props} />
    </div>
  ),
  thead: (props) => <thead className="bg-muted/60" {...props} />,
  th: (props) => (
    <th
      className="border-b border-border px-3 py-1.5 text-left font-medium [&[align=right]]:text-right"
      {...props}
    />
  ),
  td: (props) => (
    <td
      className="border-b border-border px-3 py-1.5 tabular-nums [&[align=right]]:text-right"
      {...props}
    />
  ),
};
