"use client";

import { useState, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  ScanText,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui-retab/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui-retab/dropdown-menu";
import {
  type ParseResponse,
  type ParseViewMode,
} from "@/components/viewers/lib/parse-types";

export interface ParseViewerProps {
  result: ParseResponse | null;
  isProcessing?: boolean;
  /** Render the source document for the "Document" tab. Omit to hide it. */
  renderDocument?: () => ReactNode;
}

export function ParseViewer({
  result,
  isProcessing = false,
  renderDocument,
}: ParseViewerProps) {
  const resolvedPages = result?.output?.pages ?? [];
  const hasOutput = result !== null && resolvedPages.length > 0;
  const [currentPage, setCurrentPage] = useState(0);
  const [activeTab, setActiveTab] = useState<ParseViewMode>("text");

  const tabs: { id: ParseViewMode; label: string }[] = [
    { id: "text", label: "Text" },
    { id: "rendered", label: "Rendered" },
    ...(renderDocument ? [{ id: "file" as const, label: "Document" }] : []),
  ];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {hasOutput ? (
        <div className="flex shrink-0 items-center gap-1 border-b border-border bg-background px-2 py-1.5">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                activeTab === tab.id
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted",
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      ) : null}
      <div className="relative flex min-h-0 w-full flex-1 flex-col overflow-hidden">
        {hasOutput && resolvedPages.length > 1 && activeTab !== "file" && (
          <div className="absolute top-4 right-4 z-20 flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 bg-background"
              onClick={() => setCurrentPage(currentPage - 1)}
              disabled={currentPage === 0}
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 bg-background px-3">
                  Page {currentPage + 1} / {resolvedPages.length}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="max-h-96 overflow-auto">
                {resolvedPages.map((_, index) => (
                  <DropdownMenuItem
                    key={index}
                    onClick={() => setCurrentPage(index)}
                    className={currentPage === index ? "bg-muted" : ""}
                  >
                    Page {index + 1}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 bg-background"
              onClick={() => setCurrentPage(currentPage + 1)}
              disabled={currentPage === resolvedPages.length - 1}
              aria-label="Next page"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
        {!hasOutput ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-muted px-8 text-muted-foreground">
            {isProcessing ? (
              <>
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
                <p className="text-center text-base text-muted-foreground">Parsing...</p>
              </>
            ) : (
              <>
                <ScanText className="h-16 w-16 text-muted-foreground" />
                <p className="text-center text-base text-muted-foreground">
                  Run parse to see output
                </p>
                <p className="max-w-sm text-center text-sm text-muted-foreground">
                  Upload a document and click Run Parse
                </p>
              </>
            )}
          </div>
        ) : (
          <>
            {activeTab === "text" && (
              <div className="flex min-h-0 flex-1 overflow-auto bg-background p-5 text-xs whitespace-pre-wrap">
                {resolvedPages[currentPage]}
              </div>
            )}

            {activeTab === "rendered" && (
              <div className="flex min-h-0 flex-1 overflow-auto bg-background p-5">
                <div className="prose prose-sm w-full max-w-none">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    rehypePlugins={[rehypeRaw]}
                    components={{
                      h1: ({ ...props }) => (
                        <h1 className="text-4xl font-extrabold" {...props} />
                      ),
                      h2: ({ ...props }) => (
                        <h2 className="text-3xl font-bold" {...props} />
                      ),
                      h3: ({ ...props }) => (
                        <h3 className="text-2xl font-semibold" {...props} />
                      ),
                      h4: ({ ...props }) => (
                        <h4 className="text-xl font-medium" {...props} />
                      ),
                      h5: ({ ...props }) => (
                        <h5 className="text-lg font-normal" {...props} />
                      ),
                      h6: ({ ...props }) => (
                        <h6 className="text-base font-light" {...props} />
                      ),
                      td: ({ ...props }) => (
                        <td className="border bg-muted px-2 py-1" {...props} />
                      ),
                      th: ({ ...props }) => (
                        <td className="border bg-muted px-2 py-1" {...props} />
                      ),
                    }}
                  >
                    {resolvedPages[currentPage]}
                  </ReactMarkdown>
                </div>
              </div>
            )}

            {activeTab === "file" && renderDocument && (
              <div className="flex min-h-0 flex-1 overflow-auto bg-muted">
                {renderDocument()}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
