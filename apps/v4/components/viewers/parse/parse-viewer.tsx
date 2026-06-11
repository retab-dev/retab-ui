"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  ScanText,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Spinner } from "@/components/ui/spinner";
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
   * markdown full-width. The document is expected to tag its pages with
   * `data-page-number` so the viewer can scroll to a page on request.
   */
  renderDocument?: (handlers: ParseDocumentHandlers) => ReactNode;
}

export function ParseViewer({
  result,
  isProcessing = false,
  renderDocument,
}: ParseViewerProps) {
  const pages = result?.output?.pages ?? [];
  const hasOutput = result !== null && pages.length > 0;

  const [currentPage, setCurrentPage] = useState(0); // 0-based
  const [mode, setMode] = useState<ParseViewMode>("rendered");

  const docRef = useRef<HTMLDivElement | null>(null);

  // The document reports its visible page (1-based) as it scrolls; mirror it.
  const handleDocPage = useCallback(
    (page: number) =>
      setCurrentPage((prev) => {
        const next = Math.min(Math.max(0, page - 1), Math.max(0, pages.length - 1));
        return next === prev ? prev : next;
      }),
    [pages.length],
  );

  // Page nav from the markdown side scrolls the document to match.
  const goToPage = useCallback((index: number) => {
    setCurrentPage(index);
    docRef.current
      ?.querySelector<HTMLElement>(`[data-page-number="${index + 1}"]`)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

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
    <OutputPane
      pages={pages}
      currentPage={currentPage}
      mode={mode}
      onModeChange={setMode}
      onPageChange={goToPage}
      paired={!!renderDocument}
    />
  );

  if (!renderDocument) {
    return <div className="flex min-h-0 flex-1 flex-col">{output}</div>;
  }

  return (
    <ResizablePanelGroup direction="horizontal" className="min-h-0 flex-1">
      <ResizablePanel defaultSize={52} minSize={28}>
        <div ref={docRef} className="h-full min-w-0">
          {renderDocument({ onCurrentPageChange: handleDocPage })}
        </div>
      </ResizablePanel>
      <ResizableHandle withHandle />
      <ResizablePanel defaultSize={48} minSize={28}>
        {output}
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}

function OutputPane({
  pages,
  currentPage,
  mode,
  onModeChange,
  onPageChange,
  paired,
}: {
  pages: string[];
  currentPage: number;
  mode: ParseViewMode;
  onModeChange: (mode: ParseViewMode) => void;
  onPageChange: (index: number) => void;
  paired: boolean;
}) {
  const text = pages[currentPage] ?? "";
  const viewportRef = useRef<HTMLDivElement | null>(null);

  // A new page starts at the top of the markdown pane.
  useEffect(() => {
    viewportRef.current?.scrollTo({ top: 0 });
  }, [currentPage, mode]);

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col bg-background">
      <div className="flex h-10 shrink-0 items-center gap-2 border-b bg-card px-3">
        <span className="hidden text-xs font-medium text-muted-foreground sm:inline">
          {paired ? "Extracted" : "Parsed output"}
        </span>
        {pages.length > 1 ? (
          <div className="ml-auto flex items-center gap-0.5">
            <Button
              variant="ghost"
              size="icon-sm"
              className="size-7"
              aria-label="Previous page"
              disabled={currentPage === 0}
              onClick={() => onPageChange(currentPage - 1)}
            >
              <ChevronLeft />
            </Button>
            <span className="px-1 text-xs tabular-nums text-muted-foreground">
              {currentPage + 1} / {pages.length}
            </span>
            <Button
              variant="ghost"
              size="icon-sm"
              className="size-7"
              aria-label="Next page"
              disabled={currentPage === pages.length - 1}
              onClick={() => onPageChange(currentPage + 1)}
            >
              <ChevronRight />
            </Button>
          </div>
        ) : null}
        <div className={cn("flex items-center gap-2.5", pages.length > 1 ? "" : "ml-auto")}>
          <ModeToggle mode={mode} onChange={onModeChange} />
          <CopyButton text={text} />
        </div>
      </div>

      <ScrollArea viewportRef={viewportRef} className="min-h-0 flex-1">
        {mode === "rendered" ? (
          <div className="px-7 py-6 text-sm leading-relaxed">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeRaw]}
              components={markdownComponents}
            >
              {text}
            </ReactMarkdown>
          </div>
        ) : (
          <pre className="px-7 py-6 font-mono text-xs leading-relaxed whitespace-pre-wrap text-foreground/90">
            {text}
          </pre>
        )}
      </ScrollArea>
    </div>
  );
}

function ModeToggle({
  mode,
  onChange,
}: {
  mode: ParseViewMode;
  onChange: (mode: ParseViewMode) => void;
}) {
  const options: { id: ParseViewMode; label: string }[] = [
    { id: "rendered", label: "Rendered" },
    { id: "text", label: "Text" },
  ];
  return (
    <div className="flex items-center gap-3 text-xs">
      {options.map((opt) => (
        <button
          key={opt.id}
          type="button"
          onClick={() => onChange(opt.id)}
          className={cn(
            "relative py-0.5 font-medium transition-colors",
            mode === opt.id
              ? "text-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {opt.label}
          {mode === opt.id ? (
            <span className="absolute -bottom-0.5 inset-x-0 h-px bg-foreground" />
          ) : null}
        </button>
      ))}
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      className="size-7"
      aria-label="Copy markdown"
      title="Copy markdown"
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
    <code
      className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]"
      {...props}
    />
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
