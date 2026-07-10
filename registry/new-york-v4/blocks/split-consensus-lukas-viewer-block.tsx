"use client";

import * as React from "react";

import { cn } from "@/lib/utils";
import {
  FileViewer,
  FileViewerContent,
  FileViewerControls,
  FileViewerHeader,
  FileViewerInset,
  FileViewerProvider,
  FileViewerSidebar,
  FileViewerSidebarContent,
  FileViewerSidebarTrigger,
  FileViewerTitle,
  FileViewerViewport,
} from "@/components/ui/file-viewer";
import {
  PdfViewerPages,
  PdfViewerProvider,
  type PdfViewerHandle,
} from "@/components/ui/pdf-viewer";
import {
  SHOWCASE_DOC,
  type ShowcaseSeg,
} from "@/registry/new-york-v4/blocks/split-consensus-lukas-data";

const POLITAX_ASSET_BASE_URL =
  "https://storage.googleapis.com/retab-public-assets/politaxsplit";

const DOC = SHOWCASE_DOC;

const SOURCE = {
  kind: "url" as const,
  downloadUrl: remotePdfUrl(DOC.document),
  fileName: DOC.document,
  url: proxiedPdfUrl(DOC.document),
};

// Vertical strip layout copied from the Lukas Bjorkland split benchmark post.
// Three columns (GT, Split v1, Split v2). Pages run top to bottom. The SVG is
// sized to its measured container so the bars fill the full sidebar height and
// width without distorting the labels.
const DEFAULT_W = 320;
const DEFAULT_H = 560;
const PAD = { top: 44, right: 10, bottom: 28, left: 48 };
const NUM_COLS = 3;
const COL_GAP = 12;

const TYPE_COLORS: Record<string, string> = {
  "Form 1040": "#4e79a7",
  "Schedule 1 (Form 1040)": "#f28e2b",
  "Schedule 2 (Form 1040)": "#e15759",
  "Schedule 3 (Form 1040)": "#ff9da7",
  "Schedule 4 (Form 1040)": "#86bcb6",
  "Schedule 5 (Form 1040)": "#bab0ac",
  "Form 2210": "#9c755f",
  "Schedule A (Form 1040)": "#76b7b2",
  "Schedule B (Form 1040)": "#59a14f",
  "Schedule C (Form 1040)": "#edc948",
  "Schedule D (Form 1040)": "#b07aa1",
  "Schedule E (Form 1040)": "#fabfd2",
  "Schedule H (Form 1040)": "#8cd17d",
  "Schedule SE (Form 1040)": "#d4a6c8",
  "Schedule K-1 (Form 1065)": "#ff7f50",
  "Schedule K-1 (Form 1120-S)": "#ffb347",
  "Schedule K (Form 1065)": "#c49c94",
  "Schedule L (Form 1065)": "#dbdb8d",
  "Schedule M-2 (Form 1065)": "#8d6e63",
  "Schedule M-3 (Form 1120/1065)": "#9edae5",
  "Form 1065": "#17becf",
  "Form 1120-S": "#aec7e8",
  "Form 4562": "#ffbb78",
  "Form 4136": "#98df8a",
  "Form 4797": "#f7b6d2",
  "Form 5471": "#c5b0d5",
  "Form 6251": "#a0cbe8",
  "Form 709": "#c68a89",
  "Form 8283": "#e7cb94",
  "Form 8582": "#e7ba52",
  "Form 8858": "#a65628",
  "Form 8865": "#ff9896",
  "Form 8886": "#bd7ebe",
  "Form 8938": "#c7c7c7",
  "Form 8949": "#9467bd",
  "Form 8960": "#d7b5a6",
  "Form IL-1040": "#bcbd22",
  "Form IL-2210": "#2ca02c",
  misc_form: "#aab4bd",
  supplement: "#499894",
  other: "#6b7280",
};

type Col = {
  key: string;
  label: string;
  labelClassName: string;
  segs: ShowcaseSeg[];
};

type Hovered = {
  colKey: string;
  seg: ShowcaseSeg;
  cx: number;
  cy: number;
} | null;

export function SplitConsensusLukasViewerBlock() {
  const [currentPage, setCurrentPage] = React.useState(1);
  const pdfRef = React.useRef<PdfViewerHandle | null>(null);

  const jumpToPage = React.useCallback((page: number) => {
    setCurrentPage(page);
    pdfRef.current?.scrollToPage(page, { behavior: "smooth" });
  }, []);

  return (
    <div className="bg-background flex h-full min-h-[760px] flex-col">
      <FileViewerProvider source={SOURCE} defaultSidebarOpen>
        <FileViewer className="bg-background">
          <PdfViewerProvider>
            <FileViewerHeader>
              <FileViewerSidebarTrigger className="-ms-1" />
              <FileViewerTitle />
              <FileViewerControls />
            </FileViewerHeader>
            <FileViewerContent>
              <SplitConsensusSidebar
                currentPage={currentPage}
                onJump={jumpToPage}
              />
              <FileViewerInset>
                <FileViewerViewport>
                  <PdfViewerPages
                    ref={pdfRef}
                    bare
                    className="h-full"
                    onVisiblePageChange={(page) => setCurrentPage(page)}
                  />
                </FileViewerViewport>
              </FileViewerInset>
            </FileViewerContent>
          </PdfViewerProvider>
        </FileViewer>
      </FileViewerProvider>
    </div>
  );
}

function SplitConsensusSidebar({
  currentPage,
  onJump,
}: {
  currentPage: number;
  onJump: (page: number) => void;
}) {
  return (
    <FileViewerSidebar
      aria-label="Split consensus segments"
      width="23rem"
      className="border-r"
    >
      <FileViewerSidebarContent>
        <SegmentStripChart currentPage={currentPage} onJump={onJump} />
      </FileViewerSidebarContent>
    </FileViewerSidebar>
  );
}

function SegmentStripChart({
  currentPage,
  onJump,
}: {
  currentPage: number;
  onJump: (page: number) => void;
}) {
  const [hovered, setHovered] = React.useState<Hovered>(null);
  const [ref, size] = useElementSize<HTMLDivElement>();

  const W = size.width || DEFAULT_W;
  const H = size.height || DEFAULT_H;
  const innerW = Math.max(W - PAD.left - PAD.right, 1);
  const innerH = Math.max(H - PAD.top - PAD.bottom, 1);
  const colW = Math.max((innerW - COL_GAP * (NUM_COLS - 1)) / NUM_COLS, 1);

  const cols: Col[] = [
    {
      key: "gt",
      label: "Ground truth",
      labelClassName: "fill-foreground font-semibold",
      segs: DOC.ground_truth,
    },
    {
      key: "v1",
      label: "Split v1",
      labelClassName: "fill-muted-foreground",
      segs: DOC.v1,
    },
    {
      key: "v2",
      label: "Split v2",
      labelClassName: "fill-emerald-500",
      segs: DOC.v2,
    },
  ];

  const pages = DOC.page_count;
  const colX = (index: number) => PAD.left + index * (colW + COL_GAP);
  const yFor = (page: number) => PAD.top + ((page - 1) / pages) * innerH;
  const hFor = (start: number, end: number) =>
    Math.max(((end - start + 1) / pages) * innerH, 1.4);

  const tickStep = Math.max(10, Math.round(pages / 10 / 5) * 5);
  const ticks: number[] = [1];
  for (let page = tickStep; page <= pages; page += tickStep) ticks.push(page);
  if (ticks[ticks.length - 1] !== pages) ticks.push(pages);

  const cursorY = yFor(Math.max(1, Math.min(pages + 1, currentPage)));

  return (
    <div
      ref={ref}
      className="flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden px-3 py-3"
    >
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width={W}
        height={H}
        className="text-muted-foreground block"
        aria-label={`Ground truth vs Split v1 vs Split v2 - ${DOC.pretty_name}`}
      >
        {cols.map((col, index) => (
          <g key={`hdr-${col.key}`}>
            <text
              x={colX(index) + colW / 2}
              y={PAD.top - 20}
              textAnchor="middle"
              fontFamily="ui-monospace,monospace"
              fontSize={11}
              className={col.labelClassName}
            >
              {col.label}
            </text>
            <text
              x={colX(index) + colW / 2}
              y={PAD.top - 7}
              textAnchor="middle"
              fontFamily="ui-monospace,monospace"
              fontSize={9}
              className="fill-muted-foreground"
            >
              {col.segs.length} segs
            </text>
          </g>
        ))}

        {cols.map((col, index) => {
          const cx = colX(index);
          return (
            <g key={col.key}>
              <rect
                x={cx}
                y={PAD.top}
                width={colW}
                height={innerH}
                rx={3}
                className="fill-muted"
              />
              {col.segs.map((seg, segmentIndex) => {
                const sy = yFor(seg.s);
                const sh = hFor(seg.s, seg.e);
                const isHovered =
                  hovered?.colKey === col.key && hovered.seg === seg;
                const isActive =
                  currentPage >= seg.s && currentPage < seg.e + 1;
                return (
                  <rect
                    key={segmentIndex}
                    x={cx + 1}
                    y={sy}
                    width={colW - 2}
                    height={sh}
                    fill={colorForType(seg.t)}
                    className={cn(
                      isHovered
                        ? "stroke-foreground"
                        : isActive
                          ? "stroke-foreground"
                          : "stroke-background",
                    )}
                    strokeWidth={isHovered ? 1.5 : isActive ? 1.5 : 0.4}
                    opacity={
                      hovered ? (isHovered ? 1 : 0.5) : isActive ? 1 : 0.85
                    }
                    rx={1}
                    style={{ cursor: "pointer" }}
                    onClick={() => onJump(seg.s)}
                    onMouseEnter={() =>
                      setHovered({
                        colKey: col.key,
                        seg,
                        cx: cx + colW / 2,
                        cy: sy + sh / 2,
                      })
                    }
                    onMouseLeave={() => setHovered(null)}
                  />
                );
              })}
            </g>
          );
        })}

        {ticks.map((page) => (
          <g key={page}>
            <line
              x1={PAD.left - 5}
              y1={yFor(page)}
              x2={PAD.left - 2}
              y2={yFor(page)}
              className="stroke-muted-foreground"
              strokeWidth={0.75}
            />
            <text
              x={PAD.left - 8}
              y={yFor(page) + 3}
              textAnchor="end"
              fontFamily="ui-monospace,monospace"
              fontSize={9}
              className="fill-muted-foreground"
            >
              {page}
            </text>
          </g>
        ))}

        <text
          x={12}
          y={PAD.top + innerH / 2}
          textAnchor="middle"
          fontFamily="ui-monospace,monospace"
          fontSize={9}
          className="fill-muted-foreground uppercase"
          transform={`rotate(-90, 12, ${PAD.top + innerH / 2})`}
        >
          page
        </text>

        <line
          x1={PAD.left - 2}
          y1={cursorY}
          x2={PAD.left + innerW + 2}
          y2={cursorY}
          className="stroke-foreground"
          strokeWidth={1.25}
          pointerEvents="none"
        />
        <polygon
          points={`${PAD.left - 8},${cursorY - 4} ${PAD.left - 2},${cursorY} ${PAD.left - 8},${cursorY + 4}`}
          className="fill-foreground"
          pointerEvents="none"
        />

        {hovered ? <HoverTooltip hovered={hovered} chartWidth={W} /> : null}
      </svg>
    </div>
  );
}

function HoverTooltip({
  hovered,
  chartWidth,
}: {
  hovered: NonNullable<Hovered>;
  chartWidth: number;
}) {
  const { seg } = hovered;
  const label = seg.t;
  const range =
    seg.s === seg.e
      ? `page ${seg.s}`
      : `pages ${seg.s}-${seg.e} (${seg.e - seg.s + 1})`;
  const textW = Math.max(label.length, range.length) * 6 + 28;
  let tx = hovered.cx - textW / 2;
  if (tx < PAD.left) tx = PAD.left;
  if (tx + textW > chartWidth - 4) tx = chartWidth - 4 - textW;
  const showBelow = hovered.cy < PAD.top + 40;
  const ty = showBelow ? hovered.cy + 8 : hovered.cy - 40;
  const color = colorForType(seg.t);

  return (
    <g pointerEvents="none">
      <rect
        x={tx}
        y={ty}
        width={textW}
        height={32}
        rx={4}
        className="fill-popover stroke-border"
        strokeWidth={1}
      />
      <circle cx={tx + 12} cy={ty + 10} r={4} fill={color} />
      <text
        x={tx + 20}
        y={ty + 13}
        fontFamily="ui-monospace,monospace"
        fontSize={10}
        fill={color}
        fontWeight="bold"
      >
        {label}
      </text>
      <text
        x={tx + 20}
        y={ty + 25}
        fontFamily="ui-monospace,monospace"
        fontSize={9}
        className="fill-muted-foreground"
      >
        {range}
      </text>
    </g>
  );
}

function useElementSize<T extends HTMLElement>() {
  const ref = React.useRef<T | null>(null);
  const [size, setSize] = React.useState({ width: 0, height: 0 });

  React.useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new ResizeObserver((entries) => {
      const box = entries[0]?.contentRect;
      if (!box) return;
      setSize((prev) =>
        prev.width === box.width && prev.height === box.height
          ? prev
          : { width: box.width, height: box.height },
      );
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return [ref, size] as const;
}

function remotePdfUrl(document: string): string {
  const prefix = document.split("_")[0]?.toLowerCase();
  return `${POLITAX_ASSET_BASE_URL}/pdfs/${encodeURIComponent(prefix)}/${encodeURIComponent(document)}`;
}

function proxiedPdfUrl(document: string): string {
  const prefix = document.split("_")[0]?.toLowerCase();
  return `/api/politax-pdf/${encodeURIComponent(prefix)}/${encodeURIComponent(document)}`;
}

function colorForType(type: string): string {
  return TYPE_COLORS[type] ?? "#a1a1aa";
}
