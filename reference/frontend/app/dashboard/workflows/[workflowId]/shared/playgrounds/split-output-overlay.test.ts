import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const splitPlaygroundSource = readFileSync(
  new URL("./split-playground.tsx", import.meta.url),
  "utf8",
);
const splitSegmentDiagramSource = readFileSync(
  new URL("./split-segment-diagram.tsx", import.meta.url),
  "utf8",
);

describe("Split output ribbon viewer", () => {
  test("uses the vertical ribbon next to the full PDF viewer", () => {
    expect(splitPlaygroundSource).toContain('variant="panel"');
    expect(splitPlaygroundSource).toContain(
      "flex min-h-0 min-w-0 flex-1 overflow-hidden",
    );
    expect(splitPlaygroundSource).toContain(
      "relative z-20 flex min-h-0 flex-none flex-col overflow-hidden",
    );
    expect(splitPlaygroundSource).not.toContain("<Select");
    expect(splitPlaygroundSource).not.toContain("<SelectTrigger");
    expect(splitPlaygroundSource).toContain("relative min-h-0 flex-1");
    expect(splitPlaygroundSource).not.toContain(
      "absolute left-6 top-4 z-10 w-56 bg-white",
    );
    expect(splitPlaygroundSource).not.toContain("h-full min-h-0 pt-16");
    expect(splitPlaygroundSource).not.toContain(
      "selectedRowId={selectedSplitDiagramRow?.id}",
    );
    expect(splitPlaygroundSource).toContain(
      "flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden ring-1 ring-zinc-200",
    );
    expect(splitPlaygroundSource).toContain(
      "<SplitLegendStrip splitResult={splitResult} currentPage={currentPage} />",
    );
    expect(splitPlaygroundSource).toContain('aria-label="Split legend"');
    expect(splitPlaygroundSource).toContain("grid grid-cols-4");
    expect(splitPlaygroundSource).toContain("font-semibold text-black");
    expect(splitPlaygroundSource).toContain("font-normal text-gray-600");
    expect(splitPlaygroundSource).toContain("<TooltipTrigger asChild>");
    expect(splitPlaygroundSource).toContain(
      '<TooltipContent side="bottom" className="max-w-xs break-words">',
    );
    expect(splitPlaygroundSource).toContain("Show all");
    expect(splitPlaygroundSource).toContain("Hide unused");
    expect(splitPlaygroundSource).not.toContain("canvasOverlay=");
    expect(splitPlaygroundSource).not.toContain(">Legend<");
    expect(splitPlaygroundSource).not.toContain("basis-1/2");
    expect(splitPlaygroundSource).toContain("ring-1 ring-zinc-200");
    expect(splitPlaygroundSource).not.toContain("w-[372px] shrink-0");
    expect(splitPlaygroundSource).not.toContain(
      "flex min-h-0 min-w-0 flex-1 gap-4 overflow-hidden p-4",
    );
    expect(splitSegmentDiagramSource).toContain(
      '"flex h-full min-h-0 flex-col text-zinc-950"',
    );
    expect(splitSegmentDiagramSource).not.toContain(
      '"flex h-full min-h-0 flex-col bg-white p-4 text-zinc-950"',
    );
    expect(splitPlaygroundSource).not.toContain(
      "flex min-h-0 min-w-0 flex-1 gap-4 overflow-hidden bg-white p-4",
    );
    expect(splitPlaygroundSource).not.toContain("SplitSegmentOverlay");
    expect(splitPlaygroundSource).not.toContain('variant="header"');
  });

  test("renders the split segmentation as a light page ribbon", () => {
    expect(splitSegmentDiagramSource).toContain("const SEGMENT_MAX_W = 48");
    expect(splitSegmentDiagramSource).not.toContain("const H =");
    expect(splitSegmentDiagramSource).toContain("const HORIZONTAL_GAP = 12");
    expect(splitSegmentDiagramSource).toContain("const PAGE_AXIS_W = 12");
    expect(splitSegmentDiagramSource).toContain(
      "const PAGE_LABEL_X = HORIZONTAL_GAP + PAGE_AXIS_W / 2",
    );
    expect(splitSegmentDiagramSource).toContain(
      "const SEGMENT_X = HORIZONTAL_GAP + PAGE_AXIS_W + HORIZONTAL_GAP",
    );
    expect(splitSegmentDiagramSource).toContain(
      "const SEGMENT_OUTER_GAP = SEGMENT_X",
    );
    expect(splitSegmentDiagramSource).toContain("right: SEGMENT_OUTER_GAP");
    expect(splitSegmentDiagramSource).toContain("left: SEGMENT_OUTER_GAP");
    expect(splitSegmentDiagramSource).toContain("right-[-5px]");
    expect(splitSegmentDiagramSource).toContain("left-[calc(100%+8px)]");
    expect(splitSegmentDiagramSource).not.toContain("right-[calc(100%+8px)]");
    expect(splitSegmentDiagramSource).toContain("style={{ width: viewWidth }}");
    expect(splitSegmentDiagramSource).toContain("Split result page ribbon");
    expect(splitSegmentDiagramSource).toContain("TooltipContent");
    expect(splitSegmentDiagramSource).toContain('side="right"');
    expect(splitSegmentDiagramSource).not.toContain(
      "pointer-events-none absolute z-50",
    );
    expect(splitSegmentDiagramSource).not.toContain("key={`hdr-${row.id}`}");
    expect(splitSegmentDiagramSource).not.toContain("<svg");
    expect(splitSegmentDiagramSource).not.toContain("<rect");
    expect(splitSegmentDiagramSource).not.toContain("rounded-md bg-white");
    expect(splitSegmentDiagramSource).toContain(
      "relative min-h-0 flex-1 overflow-hidden",
    );
    expect(splitSegmentDiagramSource).not.toContain("shadow-sm ring");
    expect(splitSegmentDiagramSource).not.toContain(
      "export function SplitSegmentOverlay",
    );
    expect(splitSegmentDiagramSource).not.toContain("bg-zinc-950");
  });
});
